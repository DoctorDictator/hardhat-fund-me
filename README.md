# Chainlink Crowdfunding dApp

A full-stack, multi-campaign crowdfunding protocol on Ethereum. Smart contracts in Solidity + Hardhat with Chainlink ETH/USD price feeds. Frontend in Next.js 14 with wagmi, viem, RainbowKit, and Tailwind CSS.

---

## Table of Contents

- [Architecture](#architecture)
- [Smart Contracts](#smart-contracts)
  - [CampaignFactory](#campaignfactory)
  - [Campaign](#campaign)
  - [PriceConverter](#priceconverter)
  - [MockPriceFeed](#mockpricefeed)
- [Contract Lifecycle & States](#contract-lifecycle--states)
- [Security Features](#security-features)
- [Deploy Scripts](#deploy-scripts)
- [Frontend](#frontend)
  - [Pages & Routes](#pages--routes)
  - [Components](#components)
  - [Hooks](#hooks)
  - [Libraries & Utilities](#libraries--utilities)
- [Environment Variables](#environment-variables)
- [Quickstart](#quickstart)
- [Local Development Workflow](#local-development-workflow)
- [Testing](#testing)
  - [Contract Tests (43 tests)](#contract-tests-43-tests)
- [Project Structure](#project-structure)
- [Metadata Format](#metadata-format)
- [Tech Stack](#tech-stack)
- [Scope & Limitations](#scope--limitations)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CampaignFactory                       │
│  - createCampaign(metadataURI, goalUsd, min, deadline)   │
│  - getCampaign(index)                                    │
│  - getCampaignCount()                                    │
│  - getCampaigns(offset, limit)                           │
│  - getCreatorCampaignCount(creator)                      │
│  - getCreatorCampaign(creator, index)                    │
│  - getPriceFeed()                                        │
└──────────────┬──────────────────────────────────────────┘
               │ deploys
    ┌──────────┴──────────┐
    ▼                     ▼
┌────────────┐   ┌────────────┐
│ Campaign   │   │ Campaign   │  ...one per funding round
│  #1        │   │  #2        │
└────────────┘   └────────────┘
     │
     ├─ fund()         ── anyone sends ETH (USD min via Chainlink)
     ├─ withdraw()     ── creator collects after deadline + goal met
     ├─ refund()       ── contributors reclaim on fail/cancel
     ├─ cancel()       ── creator stops before goal reached
     ├─ getState()     ── Funding | Successful | Failed | Cancelled | PaidOut
     ├─ getSummary()   ── all campaign fields as tuple
     ├─ getContribution(addr) ── contributor's ETH amount
     └─ getHasRefunded(addr)  ── whether contributor refunded
```

Each campaign reads ETH/USD pricing from a **Chainlink AggregatorV3** feed. Contributions are validated in USD: the `fund()` function converts the sent ETH to USD using the current feed price and checks it against `minContributionUsd`. The goal (`goalUsd`) is also denominated in USD.

---

## Smart Contracts

### CampaignFactory

**File:** `contracts/CampaignFactory.sol`

The factory is the entry point for the protocol. It deploys individual Campaign contracts, stores them in an array for on-chain discovery, and tracks campaigns per creator address.

**Constructor:**
- `constructor(address priceFeed)` — Requires a non-zero Chainlink feed address

**State Variables:**

| Variable | Type | Visibility | Description |
|---|---|---|---|
| `s_campaigns` | `address[]` | private | All deployed campaign addresses |
| `s_creatorCampaigns` | `mapping(address => address[])` | private | Campaigns per creator |
| `s_priceFeed` | `AggregatorV3Interface` | private | Shared price feed for all campaigns |

**Events:**
- `CampaignCreated(address indexed campaign, address indexed creator, string metadataURI, uint256 goalUsd, uint256 deadline)` — Emitted when a new campaign is deployed

**Functions:**

| Function | Visibility | Parameters | Returns | Description |
|---|---|---|---|---|
| `createCampaign` | `external` | `metadataURI, goalUsd, minContributionUsd, deadline` | `address` | Deploys a new Campaign contract, stores it, returns its address |
| `getCampaign` | `external view` | `index` | `address` | Campaign address at array index |
| `getCampaignCount` | `external view` | — | `uint256` | Total number of campaigns created |
| `getCampaigns` | `external view` | `offset, limit` | `address[]` | Paginated slice of campaign addresses |
| `getCreatorCampaignCount` | `external view` | `creator` | `uint256` | Number of campaigns a creator has deployed |
| `getCreatorCampaign` | `external view` | `creator, index` | `address` | Creator's campaign at index |
| `getPriceFeed` | `external view` | — | `address` | The shared price feed address |

**Errors:**
- `CampaignFactory_InvalidPriceFeed()` — Reverts if constructor receives zero address

**Security:**

```solidity
constructor(address priceFeed) {
    if (priceFeed == address(0)) revert CampaignFactory_InvalidPriceFeed();
    ...
}
```

---

### Campaign

**File:** `contracts/Campaign.sol`

Each campaign is an independent contract deployed by the factory. It manages its own ETH balance, contributor registry, and lifecycle state.

**Constructor:**
- `constructor(string memory _metadataURI, uint256 _goalUsd, uint256 _minContributionUsd, uint256 _deadline, address _priceFeed, address _creator)`
- Validates: future deadline, nonzero goal, nonzero minimum, nonempty metadata, nonzero price feed

**State Variables:**

| Variable | Type | Visibility | Description |
|---|---|---|---|
| `metadataURI` | `string` | `public` | URI to off-chain metadata (IPFS/HTTP) |
| `goalUsd` | `uint256` | `public` | Funding goal in USD (18 decimals) |
| `minContributionUsd` | `uint256` | `public` | Minimum contribution in USD (18 decimals) |
| `deadline` | `uint256` | `public` | Unix timestamp when funding ends |
| `creator` | `address` | `public` | Campaign creator address |
| `priceFeed` | `AggregatorV3Interface` | `public` | Chainlink ETH/USD feed |
| `totalRaisedUsd` | `uint256` | `public` | Total raised in USD (18 decimals) |
| `totalRaisedEth` | `uint256` | `public` | Total raised in ETH (wei) |
| `contributorCount` | `uint256` | `public` | Number of unique contributors |
| `withdrawn` | `bool` | `public` | Whether creator has withdrawn |
| `s_state` | `CampaignState` | `private` | Internal state tracking |
| `s_contributions` | `mapping(address => uint256)` | `private` | ETH per contributor |
| `s_hasRefunded` | `mapping(address => bool)` | `private` | Whether contributor refunded |
| `s_reentrancyGuard` | `bool` | `private` | Reentrancy lock |

**Events:**

| Event | Parameters | Description |
|---|---|---|
| `Funded` | `contributor, ethAmount, usdValue` | Emitted on successful contribution |
| `Withdrawn` | `creator, amount` | Emitted when creator withdraws |
| `Refunded` | `contributor, amount` | Emitted when contributor receives refund |
| `Cancelled` | `creator` | Emitted when creator cancels |

**Modifiers:**

| Modifier | Description |
|---|---|
| `onlyCreator` | Reverts with `Campaign_NotCreator` if `msg.sender != creator` |
| `onlyContributor` | Reverts with `Campaign_NotContributor` if sender has zero contribution |
| `isActive` | Reverts if cancelled (`Campaign_CampaignCancelled`) or deadline passed (`Campaign_CampaignEnded`) |
| `nonReentrant` | Reverts with `Campaign_Reentrant` if reentrancy detected |

**Functions:**

| Function | Access | Modifiers | Parameters | Description |
|---|---|---|---|---|
| `fund()` | `external payable` | `isActive, nonReentrant` | — | Send ETH. Checks USD >= minContributionUsd. Updates state, emits `Funded` |
| `withdraw()` | `external` | `onlyCreator, nonReentrant` | — | After deadline, if goal met, send balance to creator. Sets `withdrawn = true`. Emits `Withdrawn` |
| `refund()` | `external` | `nonReentrant` | — | Only for Failed/Cancelled/PaidOut states. Refunds full contribution. Emits `Refunded` |
| `cancel()` | `external` | `onlyCreator` | — | Cancel if goal not yet reached. Sets state to Cancelled. Emits `Cancelled` |
| `getState()` | `public view` | — | — | Returns `CampaignState` enum value |
| `getContribution()` | `external view` | — | `address contributor` | Returns contributor's ETH amount |
| `getHasRefunded()` | `external view` | — | `address contributor` | Whether contributor refunded |
| `getSummary()` | `external view` | — | — | Returns all fields as a tuple |

**Errors:**

| Error | Description |
|---|---|
| `Campaign_NotCreator()` | `msg.sender` is not the creator |
| `Campaign_NotContributor()` | Caller has no contribution |
| `Campaign_CampaignEnded()` | Deadline has passed |
| `Campaign_CampaignCancelled()` | Campaign was cancelled |
| `Campaign_DeadlineNotReached()` | Cannot withdraw before deadline |
| `Campaign_GoalNotReached()` | Goal not met for withdrawal |
| `Campaign_GoalAlreadyReached()` | Goal met (cancel blocked) or already paid out (refund blocked) |
| `Campaign_NothingToWithdraw()` | Balance is zero |
| `Campaign_TransferFailed()` | ETH transfer failed |
| `Campaign_AlreadyRefunded()` | Contributor already refunded |
| `Campaign_InvalidDeadline()` | Deadline <= block.timestamp |
| `Campaign_InvalidGoal()` | Goal is zero |
| `Campaign_InvalidMinContribution()` | Minimum contribution is zero |
| `Campaign_InvalidPriceFeed()` | Price feed is zero address |
| `Campaign_EmptyMetadata()` | Metadata URI is empty |
| `Campaign_Reentrant()` | Reentrancy detected |

**`getState()` Logic:**

```solidity
function getState() public view returns (CampaignState) {
    if (withdrawn) return CampaignState.PaidOut;       // 4 — creator withdrew
    if (s_state == CampaignState.Cancelled) return CampaignState.Cancelled; // 3
    if (totalRaisedUsd >= goalUsd) return CampaignState.Successful; // 1
    if (block.timestamp >= deadline) return CampaignState.Failed;    // 2
    return CampaignState.Funding; // 0
}
```

---

### PriceConverter

**File:** `contracts/PriceConverter.sol`

A Solidity library used by `Campaign` to fetch and validate Chainlink price data.

**Functions:**

| Function | Visibility | Parameters | Returns | Description |
|---|---|---|---|---|
| `getPrice` | `internal view` | `AggregatorV3Interface priceFeed` | `uint256` | Returns ETH/USD price in 18 decimals |
| `getConversionRate` | `internal view` | `uint256 ethAmount, AggregatorV3Interface priceFeed` | `uint256` | Converts wei to USD value (18 decimals) |

**`getPrice()` safety checks (in order):**

1. Fetches `latestRoundData()` from the price feed
2. Reverts with `PriceConverter_InvalidPrice` if `answer <= 0`
3. Reverts with `PriceConverter_StalePrice` if `updatedAt + 1 hours < block.timestamp`
4. Reverts with `PriceConverter_IncompleteRound` if `answeredInRound < roundId`
5. Normalizes price to 18 decimals using `priceFeed.decimals()`: `uint256(answer) * 10 ** (18 - decimals)`

**Errors:**

| Error | Description |
|---|---|
| `PriceConverter_StalePrice()` | Price data > 1 hour old |
| `PriceConverter_InvalidPrice()` | Zero or negative price |
| `PriceConverter_IncompleteRound()` | Round not completed |

---

### MockPriceFeed

**File:** `contracts/test/MockPriceFeed.sol`

A Solidity mock of `AggregatorV3Interface` for local/testing environments. Deployed automatically by `deployFactory.js` on Hardhat network (chainId 31337).

**Functions:**

| Function | Description |
|---|---|
| `constructor(uint8 _decimals, int256 _initialAnswer)` | Sets decimals and initial answer |
| `setLatestRoundData(roundId, answer, startedAt, updatedAt, answeredInRound)` | Manually set full round data (for testing stale/incomplete rounds) |
| `updateAnswer(int256 _answer)` | Update answer with fresh timestamp (increments round) |
| `latestRoundData()` | Returns current round data |
| `getRoundData(uint80)` | Returns current round data |

---

## Contract Lifecycle & States

```
                  ┌──────────┐
                  │  Funding  │ ◄── Campaign created
                  └────┬─────┘
                       │
            ┌──────────┼──────────────┐
            │          │              │
            ▼          ▼              ▼
     ┌──────────┐ ┌──────────┐  ┌──────────┐
     │Successful│ │  Failed  │  │Cancelled │
     │(goal met)│ │(deadline │  │(creator  │
     └────┬─────┘ │  passed) │  │ cancels) │
          │       └──────────┘  └──────────┘
          │            │              │
          ▼            ▼              ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ PaidOut  │  │ Refund   │  │ Refund   │
    │(creator  │  │available │  │available │
    │withdrew) │  │          │  │          │
    └──────────┘  └──────────┘  └──────────┘
```

| State | Value | Description |
|---|---|---|
| `Funding` | 0 | Campaign is accepting contributions |
| `Successful` | 1 | Goal reached (before creator withdraws) |
| `Failed` | 2 | Deadline passed without reaching goal |
| `Cancelled` | 3 | Creator cancelled before goal reached |
| `PaidOut` | 4 | Creator withdrew funds after success |

**Rules:**
- Overfunding is allowed until the deadline (excess stays in contract)
- Cancellation is blocked once `totalRaisedUsd >= goalUsd`
- Withdrawal is only allowed after deadline AND when goal is met
- Refunds are only available for `Failed` or `Cancelled` campaigns
- Each contributor can only refund once
- After `withdrawn = true`, `getState()` returns `PaidOut` (not `Successful`)

---

## Security Features

1. **Reentrancy guard** (`nonReentrant` modifier) on `fund()`, `withdraw()`, `refund()`
2. **Checks-Effects-Interactions** pattern — all state updates happen before external calls
3. **Chainlink price validation** in `PriceConverter.getPrice()`:
   - Stale data: revert if `updatedAt + 1 hour < block.timestamp`
   - Invalid price: revert if `answer <= 0`
   - Incomplete round: revert if `answeredInRound < roundId`
   - Dynamic decimals: normalizes feeds with any decimal count (8, 18, etc.)
4. **Constructor validation** — reverts on: past deadline, zero goal, zero minimum, empty metadata, zero price feed
5. **Custom Solidity errors** — gas-efficient error handling (no string messages)
6. **State machine enforcement** — `isActive` modifier blocks actions in wrong states
7. **Use `call` over `transfer`/`send`** — forwards all available gas in ETH transfers

---

## Deploy Scripts

### deployFactory.js

**File:** `scripts/deployFactory.js`

Primary deploy script for the crowdfunding protocol.

**Behavior:**
- On **Hardhat network** (chainId 31337): deploys a `MockPriceFeed` with 8 decimals and $2000 initial price, then deploys `CampaignFactory` using the mock address
- On **Sepolia** (chainId 11155111): reads the real ETH/USD feed address from `helper-hardhat-config.js` and deploys `CampaignFactory`
- Can be `require()`'d in tests without side effects (uses `require.main === module` guard)

**Usage:**

```bash
# Local
npx hardhat run scripts/deployFactory.js

# Sepolia
npx hardhat run scripts/deployFactory.js --network sepolia
```

**Exports:**
- `deployFactory()` — async function returning the deployed factory contract
- `DECIMALS` — mock feed decimals (8)
- `INITIAL_PRICE` — mock feed initial price (2000 USD, 8 decimals)

### deployFundMe.js

**File:** `scripts/deployFundMe.js`

Legacy deploy script for the retired `FundMe` tutorial contract. Kept for reference. Uses the same `require.main === module` guard pattern.

### export-abis.js

**File:** `scripts/export-abis.js`

Copies the compiled `CampaignFactory` and `Campaign` ABIs from `artifacts/contracts/` to `frontend/src/abis/` as JSON files so the frontend can import them.

**Usage:**

```bash
npm run export-abis
# or: hardhat compile && node scripts/export-abis.js
```

**Output:**
- `frontend/src/abis/CampaignFactory.json` — `{ "abi": [...] }`
- `frontend/src/abis/Campaign.json` — `{ "abi": [...] }`

---

## Frontend

**Directory:** `frontend/`

A Next.js 14 App Router dApp built with wagmi 2, viem 2, RainbowKit 2, Tailwind CSS 3, and lucide-react icons.

### Pages & Routes

#### `/` — Campaign Explorer (`src/app/page.tsx`)

Displays all campaigns in a responsive grid of `CampaignCard` components. Shows loading spinner while fetching, or an empty state message when no campaigns exist.

Data flow:
1. `CampaignList` calls `useAllCampaigns()`
2. `useAllCampaigns()` reads `getCampaignCount()` then `getCampaigns(0, N)` from factory
3. Uses `useReadContracts` (multicall equivalent) to fetch `getSummary()` for each address
4. Maps results into `CampaignSummary[]` and renders `CampaignCard` for each

#### `/create` — Create Campaign (`src/app/create/page.tsx`)

Form with four fields:

| Field | Type | Validation |
|---|---|---|
| Metadata URI | Text | Required, non-empty |
| Goal (USD) | Number | Required, > 0 |
| Minimum Contribution (USD) | Number | Required, > 0 |
| Duration (days) | Number | Required, >= 1 |

**Behavior:**
- Shows a yellow warning banner if wallet is not connected
- On submit: converts USD values via `parseEther()` (18-decimal units), computes `deadline = now + days * 86400`, calls `createCampaign` on factory
- Button shows: "Create Campaign" / "Confirm in Wallet..." / "Deploying..." based on tx state
- On success: shows a green checkmark screen with "View All Campaigns" button
- On error: displays the error message below the form

#### `/campaign/[address]` — Campaign Detail (`src/app/campaign/[address]/page.tsx`)

The main interaction page. Shows:

1. **Metadata preview** — image, name, description (with loading skeleton and error fallback)
2. **Status badge** and **countdown timer**
3. **Progress bar** — USD raised vs goal, percentage
4. **Stats grid** — ETH goal vs raised, contributor count
5. **Contribution display** — shows "Your contribution: X ETH" if connected user has contributed
6. **Action buttons** (conditional):

| Condition | Button | Hook |
|---|---|---|
| State is `Funding`, user connected, not creator | Fund input + button | `useFund()` |
| Creator, state is `Successful` or `PaidOut`, not yet withdrawn | Withdraw button | `useWithdraw()` |
| Creator, state is `Funding` | Cancel button | `useCancel()` |
| State is `Failed` or `Cancelled`, user has contributed | Refund button | `useRefund()` |

7. **Contract address** and **creator address** display

**Transaction feedback:** Each action button shows pending → confirming → success/error states. Auto-refetches campaign data 2 seconds after successful tx.

#### `/dashboard` — Dashboard (`src/app/dashboard/page.tsx`)

Shows campaigns created by the connected wallet.

- Redirects to connect prompt if wallet not connected
- Filters `useAllCampaigns()` results by `creator === userAddress`
- Renders results in a 2-column grid of `CampaignCard` components
- Shows empty state message if no campaigns

### Components

#### Header (`src/components/Header.tsx`)

Global navigation bar with:
- Logo (CircleDollarSign icon + "Crowdfund") linking to `/`
- "Create" link (visible always)
- "Dashboard" link (visible only when connected)
- RainbowKit `ConnectButton`

#### CampaignCard (`src/components/CampaignCard.tsx`)

A clickable card wrapping a campaign preview, used on `/` and `/dashboard`.

**Layout:**
- `MetadataPreview` — campaign image/title/description
- `StatusBadge` + `CountdownTimer` row
- `ProgressBar` — USD goal progress
- Footer: contributor count + total ETH raised

Makes the entire card a `Link` to `/campaign/[address]`.

#### CampaignList (`src/components/CampaignList.tsx`)

Orchestrates fetching and displaying campaigns. Handles three states:
1. **Loading** — centered spinning `Loader2` icon
2. **Empty** — "No campaigns yet" message with `Inbox` icon
3. **Data** — responsive grid (1/2/3 columns) of `CampaignCard`

#### ProgressBar (`src/components/ProgressBar.tsx`)

Renders a labeled progress bar:
- Left label: "X USD raised"
- Right label: "Y USD goal"
- Blue/green fill bar
- Percentage text below

Uses `getProgress()` from `format.ts` which computes `(current * 10000 / goal) / 100`, capped at 100%.

#### StatusBadge (`src/components/StatusBadge.tsx`)

Renders a colored pill badge based on campaign state:

| State | Color |
|---|---|
| Funding | Blue |
| Successful | Green |
| Failed | Red |
| Cancelled | Gray |
| Paid Out | Purple |

#### CountdownTimer (`src/components/CountdownTimer.tsx`)

Shows real-time countdown: "Xd Yh left", "Xh Ym left", "Xm left", or "Ended" (red when expired). Updates every 10 seconds.

#### MetadataPreview (`src/components/MetadataPreview.tsx`)

Fetches and displays campaign metadata from the URI.

**States:**
1. **Loading** — gray skeleton placeholder (image + two text lines)
2. **Error/unavailable** — dashed border box with "Metadata unavailable" and truncated URI
3. **Loaded** — displays image (with `onError` fallback), name, and description (3-line clamp)

Supports `ipfs://` URIs (resolved via `https://ipfs.io/ipfs/...`).

#### ConnectButton (`src/components/ConnectButton.tsx`)

Simply wraps RainbowKit's `<ConnectButton />`.

### Hooks

#### `src/hooks/useCampaigns.ts`

| Hook | Reads | Parameters | Returns |
|---|---|---|---|
| `useCampaignCount()` | `getCampaignCount` | — | contract query result |
| `useCampaignAddresses(offset, limit)` | `getCampaigns` | `offset, limit` | contract query result |
| `useCampaignSummary(address)` | `getSummary` | campaign address | contract query result |
| `useCampaignContribution(address, contributor)` | `getContribution` | `address, contributor` | contribution in wei |
| `useCreatorCampaignCount(creator)` | `getCreatorCampaignCount` | creator address | count |
| `useCreatorCampaign(creator, index)` | `getCreatorCampaign` | `creator, index` | campaign address |
| `useAllCampaigns()` | Composes above | — | `{ campaigns: CampaignSummary[], isLoading, error }` |

**`useAllCampaigns` data flow:**

```
1. useCampaignCount()          → total count
2. useCampaignAddresses(0, N)  → address[]
3. useReadContracts()          → getSummary() for each address (multicall)
4. Map results → CampaignSummary[]
```

#### `src/hooks/useCampaign.ts`

| Hook | Function | Contract Call | State Shape |
|---|---|---|---|
| `useFund(address)` | `fund(valueEth)` | `fund()` with `value: parseEther(valueEth)` | `TransactionState` |
| `useWithdraw(address)` | `withdraw()` | `withdraw()` | `TransactionState` |
| `useRefund(address)` | `refund()` | `refund()` | `TransactionState` |
| `useCancel(address)` | `cancel()` | `cancel()` | `TransactionState` |
| `useCreateCampaign()` | `createCampaign(uri, goal, min, deadline)` | `createCampaign()` on factory | `TransactionState` |

Each hook returns `{ action, tx, setTx }` where `tx` is a `TransactionState`:

```typescript
interface TransactionState {
  status: "idle" | "pending" | "confirming" | "success" | "error"
  hash?: `0x${string}`
  error?: string
}
```

Additional helper:
- `useTransactionConfirm(hash)` — wraps `useWaitForTransactionReceipt` to track confirmation

#### `src/hooks/useMetadata.ts`

Fetches JSON metadata from a URI with automatic cleanup on unmount.

```typescript
useMetadata(uri: string | undefined): { metadata: CampaignMetadata | null, loading: boolean, error: boolean }
```

### Libraries & Utilities

#### `src/lib/constants.ts`

```typescript
FACTORY_ADDRESS        // from NEXT_PUBLIC_FACTORY_ADDRESS
CHAIN_ID               // from NEXT_PUBLIC_CHAIN_ID
WALLETCONNECT_PROJECT_ID // from NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
CHAINS                 // { 31337: hardhat config, 11155111: sepolia config }
```

#### `src/lib/format.ts`

| Function | Input | Output | Description |
|---|---|---|---|
| `formatUsd(usdWei)` | `bigint` (18 dec) | `"$1,000.00"` | USD formatted string |
| `formatEth(wei)` | `bigint` (wei) | `"0.0100 ETH"` or `"< 0.001 ETH"` | ETH formatted string |
| `getProgress(current, goal)` | `bigint, bigint` | `number` (0–100) | Percentage progress |
| `getStateLabel(state)` | `CampaignState` | `string` | Human-readable state name |
| `getStateColor(state)` | `CampaignState` | `string` | Tailwind CSS classes |
| `getDeadlineInfo(deadline)` | `bigint` | `{ text, expired }` | Countdown or "Ended" |

#### `src/lib/metadata.ts`

| Function | Description |
|---|---|
| `normalizeMetadataURI(uri)` | Converts `ipfs://` → `https://ipfs.io/ipfs/` |
| `fetchMetadata(uri)` | Fetches JSON from URI (5s timeout), returns `CampaignMetadata \| null` |
| `normalizeImageURI(uri)` | Normalizes image field within metadata (IPFS → HTTP) |

#### `src/lib/wagmi.ts`

Configures wagmi with:
- Dynamic chain selection (Hardhat for 31337, Sepolia for 11155111)
- RainbowKit connectors: Rainbow Wallet, MetaMask, WalletConnect
- HTTP transport

### Types (`src/types/index.ts`)

```typescript
enum CampaignState { Funding, Successful, Failed, Cancelled, PaidOut }

interface CampaignMetadata {
  name?: string
  description?: string
  image?: string
}

interface CampaignSummary {
  creator: `0x${string}`
  metadataURI: string
  goalUsd: bigint
  totalRaisedUsd: bigint
  totalRaisedEth: bigint
  deadline: bigint
  state: CampaignState
  contributorCount: bigint
  withdrawn: boolean
  address: `0x${string}`
}

interface TransactionState {
  status: "idle" | "pending" | "confirming" | "success" | "error"
  hash?: `0x${string}`
  error?: string
}
```

---

## Environment Variables

### Frontend (`frontend/.env.local`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_FACTORY_ADDRESS` | Yes | — | Deployed CampaignFactory contract address (e.g. `0x...`) |
| `NEXT_PUBLIC_CHAIN_ID` | Yes | `31337` | Chain ID: `31337` for local Hardhat, `11155111` for Sepolia |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | For WC | — | Project ID from [WalletConnect Cloud](https://cloud.walletconnect.com) |

### Contract Deployment (root `.env`)

| Variable | Description |
|---|---|
| `SEPOLIA_RPC_URL` | Alchemy/Infura RPC URL for Sepolia |
| `PRIVATE_KEY` | Deployer wallet private key (with `0x` prefix) |
| `ETHERSCAN_API_KEY` | Etherscan API key for `npx hardhat verify` |

---

## Quickstart

### Prerequisites

- Node.js 18+ (use a version supported by Hardhat — v18 or v20 recommended)
- MetaMask or Rainbow Wallet browser extension
- Git

### Setup

```bash
# Clone and install
git clone <repo-url>
cd chainlink-project-1-master
npm install

# Run contract tests
npx hardhat test

# Export ABIs for frontend
npm run export-abis

# Setup frontend
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local with your deployed factory address
```

### Deploy Locally

```bash
# Terminal 1: Start local Hardhat node
npx hardhat node

# Terminal 2: Deploy factory to localhost
npx hardhat run scripts/deployFactory.js --network localhost
# Copy the deployed CampaignFactory address

# Update frontend/.env.local:
# NEXT_PUBLIC_FACTORY_ADDRESS=<copied-address>
# NEXT_PUBLIC_CHAIN_ID=31337

# Start frontend
cd frontend
npm run dev
# Open http://localhost:3000
```

### Deploy to Sepolia

```bash
# Configure .env with:
# SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
# PRIVATE_KEY=0xYOUR_PRIVATE_KEY

npx hardhat run scripts/deployFactory.js --network sepolia
```

---

## Local Development Workflow

### Full Smoke Test

```bash
# 1. Start Hardhat node
npx hardhat node

# 2. In another terminal, deploy
npx hardhat run scripts/deployFactory.js --network localhost

# 3. Update frontend/.env.local with the factory address

# 4. Start frontend
cd frontend && npm run dev

# 5. Open http://localhost:3000
# 6. Connect MetaMask to localhost:8545 (chainId 31337)
# 7. Create a campaign
# 8. Switch to another account and fund it
# 9. Use hardhat console to advance time:
#    npx hardhat console --network localhost
#    > await ethers.provider.send("evm_increaseTime", [86400 * 8])
#    > await ethers.provider.send("evm_mine", [])
# 10. Creator can withdraw, or contributors can refund on failed/cancelled
```

### ABI Updates

After modifying contracts:

```bash
npm run export-abis
# This compiles contracts, then copies ABIs to frontend/src/abis/
```

---

## Testing

### Contract Tests (43 tests)

**File:** `test/unit/Campaign.test.js`

Runs only on development chains (`hardhat`, `localhost`). Tests are organized into 11 describe blocks:

| Describe Block | Tests | Coverage |
|---|---|---|
| `CampaignFactory` | 6 | Creation, storage, pagination, creator lookup, zero feed validation |
| `Constructor Validation` | 5 | Past deadline, zero goal, zero min, empty metadata, zero price feed |
| `Funding` | 6 | Above minimum, below minimum, after deadline, after cancel, same contributor, tracking |
| `Withdrawal` | 5 | Successful withdraw, before deadline, goal not met, non-creator, second attempt |
| `Refunds` | 6 | Failed cancel refund, exact ETH, non-contributor, double refund, successful blocked |
| `Cancellation` | 3 | Emit event, non-creator, goal reached |
| `getState` | 5 | Funding, Successful, Failed, Cancelled, PaidOut |
| `PaidOut state` | 1 | Refund blocked after withdrawal |
| `getSummary` | 1 | All fields returned |
| `Price Feed Safety` | 5 | Stale, zero, negative, incomplete round, non-8-decimal |

**Run tests:**

```bash
npx hardhat test                    # All tests
npx hardhat test test/unit/Campaign.test.js  # Only campaign tests
npx hardhat coverage                # (if installed) Coverage report
```

### Frontend Build Check

```bash
cd frontend
npm run lint      # ESLint
npm run build     # TypeScript check + production build
```

### Manual Frontend Testing

The frontend's data flow can be verified without a running node by checking:

1. **Empty state** — `/` shows "No campaigns yet" when factory has 0 campaigns
2. **Loading state** — Spinner appears during initial reads
3. **Form validation** — `/create` rejects empty fields, negative numbers
4. **Connect prompt** — `/dashboard` shows connect message when disconnected
5. **Build** — `npm run build` passes without errors

---

## Project Structure

```
├── contracts/
│   ├── Campaign.sol                   # Main campaign contract
│   ├── CampaignFactory.sol            # Factory that deploys campaigns
│   ├── PriceConverter.sol             # Chainlink price library
│   ├── FundMe.sol                     # (Legacy) Tutorial contract, retired
│   └── test/
│       ├── MockPriceFeed.sol          # v0.8 mock for campaign tests
│       └── MockV3Aggregator.sol       # v0.6 mock wrapper (legacy)
│
├── scripts/
│   ├── deployFactory.js               # CampaignFactory deployment
│   ├── deployFundMe.js                # (Legacy) FundMe deployment
│   └── export-abis.js                 # ABI JSON export for frontend
│
├── test/
│   └── unit/
│       ├── Campaign.test.js           # 43 campaign system tests
│       └── FundMe.test.js             # (Legacy) skipped in test run
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css            # Tailwind imports
│   │   │   ├── layout.tsx             # Root layout with metadata
│   │   │   ├── page.tsx               # Campaign explorer (/)
│   │   │   ├── providers.tsx          # Wagmi + RainbowKit + React Query
│   │   │   ├── create/
│   │   │   │   └── page.tsx           # Campaign creation form (/create)
│   │   │   ├── campaign/
│   │   │   │   └── [address]/
│   │   │   │       └── page.tsx       # Campaign detail (/campaign/:address)
│   │   │   └── dashboard/
│   │   │       └── page.tsx           # Creator dashboard (/dashboard)
│   │   ├── components/
│   │   │   ├── CampaignCard.tsx       # Campaign card component
│   │   │   ├── CampaignList.tsx       # Campaign grid with loading/empty
│   │   │   ├── ConnectButton.tsx      # RainbowKit connect button wrapper
│   │   │   ├── CountdownTimer.tsx     # Real-time countdown display
│   │   │   ├── Header.tsx            # Global navigation bar
│   │   │   ├── MetadataPreview.tsx    # IPFS/HTTP metadata loader
│   │   │   ├── ProgressBar.tsx        # Fundraising progress bar
│   │   │   └── StatusBadge.tsx        # Campaign state badge
│   │   ├── hooks/
│   │   │   ├── useCampaign.ts         # Write hooks (fund, withdraw, etc.)
│   │   │   ├── useCampaigns.ts        # Read hooks (summaries, lists)
│   │   │   └── useMetadata.ts         # Metadata fetching hook
│   │   ├── lib/
│   │   │   ├── constants.ts           # Environment config
│   │   │   ├── format.ts             # USD/ETH formatting helpers
│   │   │   ├── metadata.ts           # IPFS/HTTP metadata fetcher
│   │   │   └── wagmi.ts              # Wagmi/RainbowKit config
│   │   ├── types/
│   │   │   └── index.ts              # TypeScript types/enums
│   │   └── abis/
│   │       ├── Campaign.json          # Auto-exported Campaign ABI
│   │       └── CampaignFactory.json   # Auto-exported Factory ABI
│   ├── .env.local.example             # Frontend env template
│   ├── .eslintrc.json                 # ESLint config
│   ├── next.config.js                 # Next.js config
│   ├── tailwind.config.ts             # Tailwind CSS config
│   ├── postcss.config.js              # PostCSS config
│   ├── tsconfig.json                  # TypeScript config
│   └── package.json                   # Frontend dependencies
│
├── hardhat.config.js                  # Hardhat configuration
├── helper-hardhat-config.js           # Network config (price feed addresses)
├── package.json                       # Root dependencies & scripts
├── .env.example                       # Deployment env template
├── .gitignore                         # Git ignore rules
└── README.md                          # This file
```

---

## Metadata Format

Campaigns reference off-chain metadata through `metadataURI`. The frontend fetches and renders this data automatically.

### Supported URI schemes

| Scheme | Resolution |
|---|---|
| `ipfs://Qm...` | Auto-resolved to `https://ipfs.io/ipfs/Qm...` |
| `https://...` | Fetched directly |

### Expected JSON structure

All fields are optional. The frontend shows graceful fallback content when metadata is unreachable or fields are missing.

```json
{
  "name": "Help Us Build a School",
  "description": "We are raising funds to build a school in rural area. Every contribution helps!",
  "image": "ipfs://QmImageHashExample"
}
```

### Fallback behavior

| Condition | Frontend Display |
|---|---|
| Metadata loads successfully | Shows image, name, description |
| Metadata fetch fails (timeout, 404, etc.) | Dashed border box: "Metadata unavailable" + truncated URI |
| Loading | Gray skeleton animation |
| Field missing (`name`, `description`, `image`) | Silently omitted from layout |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Smart Contracts** | Solidity 0.8.7 |
| **Contract Framework** | Hardhat 2.12 |
| **Testing** | Mocha + Chai + Hardhat Toolbox |
| **Price Oracle** | Chainlink ETH/USD AggregatorV3 |
| **Frontend Framework** | Next.js 14 (App Router, React 18) |
| **Web3** | wagmi 2 + viem 2 |
| **Wallet Connection** | RainbowKit 2 |
| **State / Data** | TanStack React Query 5 |
| **Styling** | Tailwind CSS 3 |
| **Icons** | lucide-react |
| **Language** | TypeScript 5 |
| **Package Manager** | npm |

---

## Scope & Limitations

### Included

- ETH-only funding with USD conversion via Chainlink price feeds
- Multi-campaign architecture (one factory, many campaigns)
- Full campaign lifecycle: creation, funding, withdrawal, refunds, cancellation
- On-chain campaign discovery (pagination, creator lookup)
- Off-chain metadata via URI (IPFS/HTTP)
- Frontend with wallet connection, tx state management, and campaign management

### Excluded (not in scope)

- **No ERC-20 tokens** — ETH contributions only
- **No ERC-721/1155 NFTs** — no rewards or NFTs
- **No Chainlink Automation** — no Keepers for auto-finalization
- **No Chainlink VRF** — no randomness
- **No upgradeable proxies** — contracts are immutable after deploy
- **No backend** — all data comes from contract reads and events
- **No IPFS upload** — users provide pre-existing URIs
- **No governance** — single-creator model, no DAO
- **No audits** — portfolio-grade security, not production-audited

---

## Scripts Reference

### Root `package.json`

| Script | Command | Description |
|---|---|---|
| `npm test` | `hardhat test` | Run all contract tests |
| `npm run compile` | `hardhat compile` | Compile Solidity contracts |
| `npm run export-abis` | `hardhat compile && node scripts/export-abis.js` | Export ABIs to frontend |

### Frontend `package.json`

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `next dev` | Start development server on port 3000 |
| `npm run build` | `next build` | Production build with type checking |
| `npm run lint` | `next lint` | Run ESLint |
| `npm run start` | `next start` | Start production server |

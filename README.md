# Chainlink Crowdfunding Protocol

A portfolio-ready, multi-campaign crowdfunding protocol built on Ethereum with Hardhat and Chainlink ETH/USD pricing.

## Architecture

```
CampaignFactory
├── createCampaign() → deploys new Campaign
├── getCampaign(index) → campaign address
└── getCampaignCount()

Campaign (one per funding round)
├── fund() — ETH contribution with USD minimum via Chainlink
├── withdraw() — creator collects after deadline + goal met
├── refund() — contributors reclaim after failure/cancellation
├── cancel() — creator stops before goal reached
└── getState() → Funding | Successful | Failed | Cancelled
```

## Contracts

| Contract | Description |
|---|---|
| `CampaignFactory.sol` | Creates and tracks campaigns, emits `CampaignCreated` |
| `Campaign.sol` | Individual campaign with funding, withdrawal, refunds, cancellation |
| `PriceConverter.sol` | Library for Chainlink ETH/USD price with stale/zero/incomplete round safety |

## Quickstart

```bash
git clone <repo-url>
cd chainlink-project-1-master
npm install
npx hardhat test
```

## Deployment

```bash
npx hardhat run scripts/deployFactory.js --network sepolia
```

Requires `SEPOLIA_RPC_URL` and `PRIVATE_KEY` in `.env`.

## Interaction Examples

```javascript
// Create a campaign
const tx = await factory.createCampaign(
  "ipfs://QmMetadata",
  ethers.utils.parseEther("1000"),  // $1000 goal
  ethers.utils.parseEther("10"),    // $10 minimum
  deadlineTimestamp
);
const receipt = await tx.wait();
const campaignAddress = receipt.events[0].args.campaign;
const campaign = await ethers.getContractAt("Campaign", campaignAddress);

// Fund
await campaign.fund({ value: ethers.utils.parseEther("0.1") });

// Creator: withdraw after deadline when goal is met
await campaign.withdraw();

// Contributor: refund on failed/cancelled campaign
await campaign.refund();

// Creator: cancel before goal is reached
await campaign.cancel();

// Read state and contributions
await campaign.getState();
await campaign.getContribution(contributorAddress);
await campaign.getSummary();
```

## Testing

```bash
npx hardhat test            # Run all tests
npx hardhat coverage        # (optional) Coverage report
```

## Networks

- **Hardhat/Localhost** — dev, uses `MockPriceFeed`
- **Sepolia** — testnet, uses Chainlink ETH/USD feed `0x694AA1769357215DE4FAC081bf1f309aDC325306`

## Scope

- ETH-only funding
- Chainlink ETH/USD Data Feeds for pricing
- Off-chain metadata via `metadataURI` string
- No frontend, backend, ERC20, or upgradeable proxies

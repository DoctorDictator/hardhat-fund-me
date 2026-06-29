export interface CampaignMetadata {
  name?: string
  description?: string
  image?: string
}

export enum CampaignState {
  Funding,
  Successful,
  Failed,
  Cancelled,
  PaidOut,
}

export interface CampaignSummary {
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

export interface TransactionState {
  status: "idle" | "pending" | "confirming" | "success" | "error"
  hash?: `0x${string}`
  error?: string
}

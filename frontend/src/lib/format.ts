import { formatEther } from "viem"
import { CampaignState } from "@/types"

export function formatUsd(usdWei: bigint): string {
  const value = Number(usdWei) / 1e18
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatEth(wei: bigint): string {
  const eth = formatEther(wei)
  const num = Number(eth)
  if (num < 0.001) return "< 0.001 ETH"
  return `${num.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ETH`
}

export function getProgress(current: bigint, goal: bigint): number {
  if (goal === 0n) return 0
  const pct = Number((current * 10000n) / goal) / 100
  return Math.min(pct, 100)
}

export function getStateLabel(state: CampaignState): string {
  switch (state) {
    case CampaignState.Funding: return "Funding"
    case CampaignState.Successful: return "Successful"
    case CampaignState.Failed: return "Failed"
    case CampaignState.Cancelled: return "Cancelled"
    case CampaignState.PaidOut: return "Paid Out"
  }
}

export function getStateColor(state: CampaignState): string {
  switch (state) {
    case CampaignState.Funding: return "bg-blue-100 text-blue-800"
    case CampaignState.Successful: return "bg-green-100 text-green-800"
    case CampaignState.Failed: return "bg-red-100 text-red-800"
    case CampaignState.Cancelled: return "bg-gray-100 text-gray-800"
    case CampaignState.PaidOut: return "bg-purple-100 text-purple-800"
  }
}

export function getDeadlineInfo(deadline: bigint): { text: string; expired: boolean } {
  const now = BigInt(Math.floor(Date.now() / 1000))
  if (deadline <= now) return { text: "Ended", expired: true }
  const diff = Number(deadline - now)
  const days = Math.floor(diff / 86400)
  const hours = Math.floor((diff % 86400) / 3600)
  const minutes = Math.floor((diff % 3600) / 60)
  if (days > 0) return { text: `${days}d ${hours}h left`, expired: false }
  if (hours > 0) return { text: `${hours}h ${minutes}m left`, expired: false }
  return { text: `${minutes}m left`, expired: false }
}

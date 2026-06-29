"use client"

import { useReadContract, useReadContracts } from "wagmi"
import { FACTORY_ADDRESS } from "@/lib/constants"
import factoryAbi from "@/abis/CampaignFactory.json"
import campaignAbi from "@/abis/Campaign.json"
import { CampaignSummary, CampaignState } from "@/types"

const factoryAbiTyped = factoryAbi.abi as any
const campaignAbiTyped = campaignAbi.abi as any

export function useCampaignCount() {
  return useReadContract({
    address: FACTORY_ADDRESS,
    abi: factoryAbiTyped,
    functionName: "getCampaignCount",
  })
}

export function useCampaignAddresses(offset: number, limit: number) {
  return useReadContract({
    address: FACTORY_ADDRESS,
    abi: factoryAbiTyped,
    functionName: "getCampaigns",
    args: [BigInt(offset), BigInt(limit)],
  })
}

export function useCampaignSummary(address: `0x${string}` | undefined) {
  return useReadContract({
    address,
    abi: campaignAbiTyped,
    functionName: "getSummary",
    query: { enabled: !!address },
  })
}

export function useCampaignContribution(address: `0x${string}` | undefined, contributor: `0x${string}` | undefined) {
  return useReadContract({
    address,
    abi: campaignAbiTyped,
    functionName: "getContribution",
    args: contributor ? [contributor] : undefined,
    query: { enabled: !!address && !!contributor },
  })
}

export function useCreatorCampaignCount(creator: `0x${string}` | undefined) {
  return useReadContract({
    address: FACTORY_ADDRESS,
    abi: factoryAbiTyped,
    functionName: "getCreatorCampaignCount",
    args: creator ? [creator] : undefined,
    query: { enabled: !!creator },
  })
}

export function useCreatorCampaign(creator: `0x${string}` | undefined, index: number) {
  return useReadContract({
    address: FACTORY_ADDRESS,
    abi: factoryAbiTyped,
    functionName: "getCreatorCampaign",
    args: creator ? [creator, BigInt(index)] : undefined,
    query: { enabled: !!creator },
  })
}

export function useAllCampaigns(): { campaigns: CampaignSummary[]; isLoading: boolean; error: Error | null } {
  const { data: count, isLoading: countLoading } = useCampaignCount()
  const total = count ? Number(count) : 0

  const { data: addresses, isLoading: addrsLoading } = useCampaignAddresses(0, total || 100)

  const summaries = useReadContracts({
    contracts: ((addresses as `0x${string}`[]) || []).map((addr) => ({
      address: addr,
      abi: campaignAbiTyped,
      functionName: "getSummary",
    })),
    query: { enabled: !!addresses && (addresses as `0x${string}`[]).length > 0 },
  })

  const isLoading = countLoading || addrsLoading || summaries.isLoading

  const campaigns: CampaignSummary[] = ((summaries.data as any[])
    ?.map((s, i) => {
      if (!s?.result) return null
      const r = s.result as any[]
      return {
        creator: r[0] as `0x${string}`,
        metadataURI: r[1] as string,
        goalUsd: r[2] as bigint,
        totalRaisedUsd: r[3] as bigint,
        totalRaisedEth: r[4] as bigint,
        deadline: r[5] as bigint,
        state: Number(r[6]) as CampaignState,
        contributorCount: r[7] as bigint,
        withdrawn: r[8] as boolean,
        address: (addresses as `0x${string}`[])[i],
      }
    })
    .filter((x): x is CampaignSummary => x !== null)) || []

  return { campaigns, isLoading, error: summaries.error as Error | null }
}

"use client"

import { useAllCampaigns } from "@/hooks/useCampaigns"
import CampaignCard from "./CampaignCard"
import { Loader2, Inbox } from "lucide-react"

export default function CampaignList() {
  const { campaigns, isLoading } = useAllCampaigns()

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin" size={32} />
      </div>
    )
  }

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center py-20 text-gray-400">
        <Inbox size={48} />
        <p className="mt-4 text-lg">No campaigns yet</p>
        <p className="text-sm">Be the first to create one!</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {campaigns.map((c) => (
        <CampaignCard key={c.address} campaign={c} />
      ))}
    </div>
  )
}

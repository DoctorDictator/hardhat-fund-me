"use client"

import Link from "next/link"
import { CampaignSummary } from "@/types"
import { formatEth } from "@/lib/format"
import ProgressBar from "./ProgressBar"
import StatusBadge from "./StatusBadge"
import CountdownTimer from "./CountdownTimer"
import MetadataPreview from "./MetadataPreview"
import { Users } from "lucide-react"

export default function CampaignCard({ campaign }: { campaign: CampaignSummary }) {
  return (
    <Link href={`/campaign/${campaign.address}`}>
      <div className="border rounded-xl p-4 hover:shadow-lg transition-shadow bg-white">
        <MetadataPreview uri={campaign.metadataURI} />
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <StatusBadge state={campaign.state} />
            <CountdownTimer deadline={campaign.deadline} />
          </div>
          <ProgressBar current={campaign.totalRaisedUsd} goal={campaign.goalUsd} />
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Users size={14} />
              <span>{campaign.contributorCount.toString()} contributors</span>
            </div>
            <span>{formatEth(campaign.totalRaisedEth)}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

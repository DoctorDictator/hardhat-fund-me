"use client"

import { CampaignState } from "@/types"
import { getStateLabel, getStateColor } from "@/lib/format"

export default function StatusBadge({ state }: { state: CampaignState }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStateColor(state)}`}>
      {getStateLabel(state)}
    </span>
  )
}

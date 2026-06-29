"use client"

import { getProgress, formatUsd } from "@/lib/format"

export default function ProgressBar({ current, goal }: { current: bigint; goal: bigint }) {
  const pct = getProgress(current, goal)
  return (
    <div>
      <div className="flex justify-between text-sm text-gray-600 mb-1">
        <span>{formatUsd(current)} raised</span>
        <span>{formatUsd(goal)} goal</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all ${pct >= 100 ? "bg-green-500" : "bg-blue-500"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">{pct.toFixed(1)}% funded</p>
    </div>
  )
}

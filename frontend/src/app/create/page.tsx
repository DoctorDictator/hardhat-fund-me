"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAccount } from "wagmi"
import { parseEther } from "viem"
import Header from "@/components/Header"
import { useCreateCampaign, useTransactionConfirm } from "@/hooks/useCampaign"
import { Loader2, CheckCircle, AlertCircle } from "lucide-react"

export default function CreatePage() {
  const router = useRouter()
  const { isConnected } = useAccount()
  const { createCampaign, tx, setTx } = useCreateCampaign()
  const { data: receipt } = useTransactionConfirm(tx.hash)

  const [metadataURI, setMetadataURI] = useState("")
  const [goalUsd, setGoalUsd] = useState("")
  const [minContributionUsd, setMinContributionUsd] = useState("")
  const [deadlineDays, setDeadlineDays] = useState("7")
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (receipt) {
    setTx({ status: "success", hash: tx.hash })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    const newErrors: Record<string, string> = {}
    if (!metadataURI.trim()) newErrors.metadataURI = "Required"
    if (!goalUsd.trim() || isNaN(Number(goalUsd)) || Number(goalUsd) <= 0) newErrors.goalUsd = "Must be > 0"
    if (!minContributionUsd.trim() || isNaN(Number(minContributionUsd)) || Number(minContributionUsd) <= 0) newErrors.minContributionUsd = "Must be > 0"
    if (!deadlineDays.trim() || isNaN(Number(deadlineDays)) || Number(deadlineDays) < 1) newErrors.deadlineDays = "Must be >= 1"

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000)) + BigInt(Number(deadlineDays) * 86400)
    try {
      await createCampaign(
        metadataURI.trim(),
        parseEther(goalUsd),
        parseEther(minContributionUsd),
        deadline,
      )
    } catch {}
  }

  if (tx.status === "success") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-lg mx-auto px-4 py-20 text-center">
          <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Campaign Created!</h2>
          <p className="text-gray-600 mb-6">Your campaign has been deployed.</p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            View All Campaigns
          </button>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-lg mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Create Campaign</h1>
        {!isConnected && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm">
            <AlertCircle size={18} />
            Connect your wallet to create a campaign
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Metadata URI</label>
            <input
              value={metadataURI}
              onChange={(e) => setMetadataURI(e.target.value)}
              placeholder="ipfs://... or https://..."
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            {errors.metadataURI && <p className="text-red-500 text-xs mt-1">{errors.metadataURI}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Goal (USD)</label>
            <input
              type="number"
              step="any"
              min="0"
              value={goalUsd}
              onChange={(e) => setGoalUsd(e.target.value)}
              placeholder="e.g. 10000"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            {errors.goalUsd && <p className="text-red-500 text-xs mt-1">{errors.goalUsd}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Minimum Contribution (USD)</label>
            <input
              type="number"
              step="any"
              min="0"
              value={minContributionUsd}
              onChange={(e) => setMinContributionUsd(e.target.value)}
              placeholder="e.g. 10"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            {errors.minContributionUsd && <p className="text-red-500 text-xs mt-1">{errors.minContributionUsd}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Duration (days)</label>
            <input
              type="number"
              min="1"
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            {errors.deadlineDays && <p className="text-red-500 text-xs mt-1">{errors.deadlineDays}</p>}
          </div>
          <button
            type="submit"
            disabled={!isConnected || tx.status === "pending" || tx.status === "confirming"}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {(tx.status === "pending" || tx.status === "confirming") && <Loader2 className="animate-spin" size={18} />}
            {tx.status === "pending" ? "Confirm in Wallet..." : tx.status === "confirming" ? "Deploying..." : "Create Campaign"}
          </button>
          {tx.status === "error" && (
            <p className="text-red-500 text-sm">{tx.error}</p>
          )}
        </form>
      </main>
    </div>
  )
}

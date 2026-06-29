"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useAccount } from "wagmi"
import Header from "@/components/Header"
import StatusBadge from "@/components/StatusBadge"
import ProgressBar from "@/components/ProgressBar"
import CountdownTimer from "@/components/CountdownTimer"
import MetadataPreview from "@/components/MetadataPreview"
import { useCampaignSummary, useCampaignContribution } from "@/hooks/useCampaigns"
import { useFund, useWithdraw, useRefund, useCancel, useTransactionConfirm } from "@/hooks/useCampaign"
import { CampaignState } from "@/types"
import { formatEth } from "@/lib/format"
import { Loader2, AlertCircle, CheckCircle, Target, Users, Wallet, Ban } from "lucide-react"

export default function CampaignDetailPage() {
  const params = useParams()
  const address = params.address as `0x${string}`
  const { address: userAddress, isConnected } = useAccount()

  const { data: summaryRaw, isLoading, refetch } = useCampaignSummary(address)
  const summary = summaryRaw
    ? {
        creator: (summaryRaw as any[])[0] as `0x${string}`,
        metadataURI: (summaryRaw as any[])[1] as string,
        goalUsd: (summaryRaw as any[])[2] as bigint,
        totalRaisedUsd: (summaryRaw as any[])[3] as bigint,
        totalRaisedEth: (summaryRaw as any[])[4] as bigint,
        deadline: (summaryRaw as any[])[5] as bigint,
        state: Number((summaryRaw as any[])[6]) as CampaignState,
        contributorCount: (summaryRaw as any[])[7] as bigint,
        withdrawn: (summaryRaw as any[])[8] as boolean,
      }
    : null

  const { data: contributionRaw } = useCampaignContribution(address, userAddress)
  const contribution = contributionRaw as bigint | undefined

  const isCreator = isConnected && userAddress?.toLowerCase() === summary?.creator?.toLowerCase()
  const hasContributed = contribution !== undefined && contribution > 0n

  const [fundEth, setFundEth] = useState("")
  const { fund: fundAction, tx: fundTx, setTx: setFundTx } = useFund(address)
  useTransactionConfirm(fundTx.hash)
  const { withdraw: withdrawAction, tx: withdrawTx, setTx: setWithdrawTx } = useWithdraw(address)
  useTransactionConfirm(withdrawTx.hash)
  const { refund: refundAction, tx: refundTx, setTx: setRefundTx } = useRefund(address)
  useTransactionConfirm(refundTx.hash)
  const { cancel: cancelAction, tx: cancelTx, setTx: setCancelTx } = useCancel(address)
  useTransactionConfirm(cancelTx.hash)

  async function handleFund() {
    if (!fundEth) return
    try {
      await fundAction(fundEth)
      setTimeout(refetch, 2000)
    } catch {}
  }

  async function handleWithdraw() {
    try {
      await withdrawAction()
      setTimeout(refetch, 2000)
    } catch {}
  }

  async function handleRefund() {
    try {
      await refundAction()
      setTimeout(refetch, 2000)
    } catch {}
  }

  async function handleCancel() {
    try {
      await cancelAction()
      setTimeout(refetch, 2000)
    } catch {}
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="flex justify-center py-20">
          <Loader2 className="animate-spin" size={32} />
        </main>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="text-center py-20 text-gray-500">
          <AlertCircle size={48} className="mx-auto mb-4" />
          Campaign not found
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <MetadataPreview uri={summary.metadataURI} />
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <StatusBadge state={summary.state} />
            <CountdownTimer deadline={summary.deadline} />
          </div>
          <ProgressBar current={summary.totalRaisedUsd} goal={summary.goalUsd} />
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 p-3 bg-white rounded-lg border">
              <Target size={18} className="text-blue-500" />
              <div>
                <p className="text-gray-500">Goal</p>
                <p className="font-medium">{formatEth(summary.totalRaisedEth)} / {(Number(summary.goalUsd) / 1e18 / 2000).toFixed(4)} ETH</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-white rounded-lg border">
              <Users size={18} className="text-blue-500" />
              <div>
                <p className="text-gray-500">Contributors</p>
                <p className="font-medium">{summary.contributorCount.toString()}</p>
              </div>
            </div>
          </div>
          {hasContributed && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg text-sm">
              <Wallet size={18} className="text-blue-500" />
              <span>Your contribution: <strong>{formatEth(contribution!)}</strong></span>
            </div>
          )}
          {summary.state === CampaignState.Funding && isConnected && !isCreator && (
            <div className="p-4 bg-white rounded-lg border space-y-3">
              <h3 className="font-medium">Fund this campaign</h3>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={fundEth}
                  onChange={(e) => setFundEth(e.target.value)}
                  placeholder="ETH amount"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={handleFund}
                  disabled={fundTx.status === "pending" || fundTx.status === "confirming" || !fundEth}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm"
                >
                  {(fundTx.status === "pending" || fundTx.status === "confirming") && <Loader2 className="animate-spin" size={16} />}
                  Fund
                </button>
              </div>
              {fundTx.status === "error" && <p className="text-red-500 text-xs">{fundTx.error}</p>}
              {fundTx.status === "success" && <p className="text-green-600 text-xs flex items-center gap-1"><CheckCircle size={14} /> Funded!</p>}
            </div>
          )}
          {isCreator && (
            <div className="space-y-2">
              {(summary.state === CampaignState.Successful || summary.state === CampaignState.PaidOut) && !summary.withdrawn && (
                <button
                  onClick={handleWithdraw}
                  disabled={withdrawTx.status === "pending" || withdrawTx.status === "confirming"}
                  className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {(withdrawTx.status === "pending" || withdrawTx.status === "confirming") && <Loader2 className="animate-spin" size={16} />}
                  Withdraw Funds
                </button>
              )}
              {summary.state === CampaignState.Funding && (
                <button
                  onClick={handleCancel}
                  disabled={cancelTx.status === "pending" || cancelTx.status === "confirming"}
                  className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {(cancelTx.status === "pending" || cancelTx.status === "confirming") && <Loader2 className="animate-spin" size={16} />}
                  <Ban size={16} />
                  Cancel Campaign
                </button>
              )}
            </div>
          )}
          {(summary.state === CampaignState.Failed || summary.state === CampaignState.Cancelled) && hasContributed && (
            <button
              onClick={handleRefund}
              disabled={refundTx.status === "pending" || refundTx.status === "confirming"}
              className="w-full py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              {(refundTx.status === "pending" || refundTx.status === "confirming") && <Loader2 className="animate-spin" size={16} />}
              Claim Refund
            </button>
          )}
          <div className="text-xs text-gray-400 break-all">
            Contract: {address}
            <br />
            Creator: {summary.creator}
          </div>
        </div>
      </main>
    </div>
  )
}

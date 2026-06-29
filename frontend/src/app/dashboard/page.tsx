"use client"

import { useAccount } from "wagmi"
import Header from "@/components/Header"
import CampaignCard from "@/components/CampaignCard"
import { useAllCampaigns } from "@/hooks/useCampaigns"
import { AlertCircle } from "lucide-react"

export default function DashboardPage() {
  const { address, isConnected } = useAccount()
  const { campaigns: allCampaigns } = useAllCampaigns()

  const myCampaigns = address
    ? allCampaigns.filter((c) => c.creator.toLowerCase() === address.toLowerCase())
    : []

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="text-center py-20 text-gray-500">
          <AlertCircle size={48} className="mx-auto mb-4" />
          Connect your wallet to view your dashboard
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Your Created Campaigns</h2>
          {myCampaigns.length === 0 ? (
            <p className="text-gray-400">You haven&apos;t created any campaigns yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {myCampaigns.map((c) => (
                <CampaignCard key={c.address} campaign={c} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

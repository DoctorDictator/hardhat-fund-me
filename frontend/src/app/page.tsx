"use client"

import Header from "@/components/Header"
import CampaignList from "@/components/CampaignList"

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Campaign Explorer</h1>
        <CampaignList />
      </main>
    </div>
  )
}

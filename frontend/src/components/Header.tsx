"use client"

import Link from "next/link"
import ConnectButton from "./ConnectButton"
import { useAccount } from "wagmi"
import { CircleDollarSign, PlusCircle, LayoutDashboard } from "lucide-react"

export default function Header() {
  const { isConnected } = useAccount()

  return (
    <header className="border-b">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold">
          <CircleDollarSign className="text-blue-600" size={28} />
          <span>Crowdfund</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/create" className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 transition-colors">
            <PlusCircle size={18} />
            Create
          </Link>
          {isConnected && (
            <Link href="/dashboard" className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 transition-colors">
              <LayoutDashboard size={18} />
              Dashboard
            </Link>
          )}
          <ConnectButton />
        </nav>
      </div>
    </header>
  )
}

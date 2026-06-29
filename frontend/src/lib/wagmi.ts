"use client"

import { http, createConfig } from "wagmi"
import { sepolia } from "wagmi/chains"
import { connectorsForWallets } from "@rainbow-me/rainbowkit"
import { metaMaskWallet, rainbowWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets"
import { CHAIN_ID, WALLETCONNECT_PROJECT_ID } from "./constants"

const hardhat = {
  id: 31337,
  name: "Hardhat",
  network: "hardhat",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 } as const,
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
}

const chains = [CHAIN_ID === 11155111 ? sepolia : hardhat] as const

const projectId = WALLETCONNECT_PROJECT_ID || "demo"

const connectors = connectorsForWallets(
  [
    { groupName: "Recommended", wallets: [rainbowWallet, metaMaskWallet, walletConnectWallet] },
  ],
  { appName: "Crowdfunding dApp", projectId }
)

export const wagmiConfig = createConfig({
  chains,
  connectors,
  transports: {
    [chains[0].id]: http(),
  },
})

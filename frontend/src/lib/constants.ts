export const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS || "0x") as `0x${string}`
export const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "31337")
export const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ""

export const CHAINS = {
  31337: {
    id: 31337,
    name: "Hardhat",
    network: "hardhat",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
  },
  11155111: {
    id: 11155111,
    name: "Sepolia",
    network: "sepolia",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: ["https://rpc.sepolia.org"] } },
  },
} as const

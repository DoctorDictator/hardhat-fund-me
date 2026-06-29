import { CampaignMetadata } from "@/types"

export function normalizeMetadataURI(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    const cid = uri.replace("ipfs://", "")
    return `https://ipfs.io/ipfs/${cid}`
  }
  return uri
}

export async function fetchMetadata(uri: string): Promise<CampaignMetadata | null> {
  try {
    const url = normalizeMetadataURI(uri)
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const data = await res.json()
    return {
      name: typeof data.name === "string" ? data.name : undefined,
      description: typeof data.description === "string" ? data.description : undefined,
      image: typeof data.image === "string" ? normalizeImageURI(data.image) : undefined,
    }
  } catch {
    return null
  }
}

function normalizeImageURI(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    const cid = uri.replace("ipfs://", "")
    return `https://ipfs.io/ipfs/${cid}`
  }
  return uri
}

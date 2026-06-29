"use client"

import { useEffect, useState } from "react"
import { CampaignMetadata } from "@/types"
import { fetchMetadata } from "@/lib/metadata"

export function useMetadata(uri: string | undefined) {
  const [metadata, setMetadata] = useState<CampaignMetadata | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!uri) {
      setMetadata(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(false)
    fetchMetadata(uri).then((data) => {
      if (cancelled) return
      setMetadata(data)
      setLoading(false)
      if (!data) setError(true)
    }).catch(() => {
      if (cancelled) return
      setError(true)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [uri])

  return { metadata, loading, error }
}

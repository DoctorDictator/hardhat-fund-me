"use client"

import { useMetadata } from "@/hooks/useMetadata"
import { ImageIcon, FileQuestion } from "lucide-react"

export default function MetadataPreview({ uri }: { uri: string }) {
  const { metadata, loading, error } = useMetadata(uri)

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-40 bg-gray-200 rounded-lg" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
      </div>
    )
  }

  if (error || !metadata) {
    return (
      <div className="flex flex-col items-center justify-center h-40 bg-gray-50 rounded-lg border-2 border-dashed text-gray-400">
        <FileQuestion size={32} />
        <p className="text-sm mt-2">Metadata unavailable</p>
        <p className="text-xs mt-1">{uri.slice(0, 40)}...</p>
      </div>
    )
  }

  return (
    <div>
      {metadata.image && (
        <img
          src={metadata.image}
          alt={metadata.name || "Campaign image"}
          className="w-full h-48 object-cover rounded-lg mb-3"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
        />
      )}
      {metadata.name && <h3 className="text-lg font-semibold">{metadata.name}</h3>}
      {metadata.description && (
        <p className="text-sm text-gray-600 mt-1 line-clamp-3">{metadata.description}</p>
      )}
    </div>
  )
}

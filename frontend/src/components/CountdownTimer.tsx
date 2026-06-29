"use client"

import { useEffect, useState } from "react"
import { getDeadlineInfo } from "@/lib/format"
import { Clock } from "lucide-react"

export default function CountdownTimer({ deadline }: { deadline: bigint }) {
  const [info, setInfo] = useState(() => getDeadlineInfo(deadline))

  useEffect(() => {
    const interval = setInterval(() => {
      setInfo(getDeadlineInfo(deadline))
    }, 10000)
    return () => clearInterval(interval)
  }, [deadline])

  return (
    <div className={`flex items-center gap-1 text-sm ${info.expired ? "text-red-500" : "text-gray-500"}`}>
      <Clock size={14} />
      <span>{info.text}</span>
    </div>
  )
}

"use client"

import { useCallback, useState } from "react"
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { parseEther } from "viem"
import campaignAbi from "@/abis/Campaign.json"
import factoryAbi from "@/abis/CampaignFactory.json"
import { FACTORY_ADDRESS } from "@/lib/constants"
import { TransactionState } from "@/types"

const campaignAbiTyped = campaignAbi.abi as any
const factoryAbiTyped = factoryAbi.abi as any

export function useFund(campaignAddress: `0x${string}`) {
  const [tx, setTx] = useState<TransactionState>({ status: "idle" })
  const { writeContractAsync } = useWriteContract()

  const fund = useCallback(async (valueEth: string) => {
    try {
      setTx({ status: "pending" })
      const hash = await writeContractAsync({
        address: campaignAddress,
        abi: campaignAbiTyped,
        functionName: "fund",
        value: parseEther(valueEth),
      })
      setTx({ status: "confirming", hash })
      return hash
    } catch (err: any) {
      setTx({ status: "error", error: err?.message || "Transaction failed" })
      throw err
    }
  }, [campaignAddress, writeContractAsync])

  return { fund, tx, setTx }
}

export function useWithdraw(campaignAddress: `0x${string}`) {
  const [tx, setTx] = useState<TransactionState>({ status: "idle" })
  const { writeContractAsync } = useWriteContract()

  const withdraw = useCallback(async () => {
    try {
      setTx({ status: "pending" })
      const hash = await writeContractAsync({
        address: campaignAddress,
        abi: campaignAbiTyped,
        functionName: "withdraw",
      })
      setTx({ status: "confirming", hash })
      return hash
    } catch (err: any) {
      setTx({ status: "error", error: err?.message || "Transaction failed" })
      throw err
    }
  }, [campaignAddress, writeContractAsync])

  return { withdraw, tx, setTx }
}

export function useRefund(campaignAddress: `0x${string}`) {
  const [tx, setTx] = useState<TransactionState>({ status: "idle" })
  const { writeContractAsync } = useWriteContract()

  const refund = useCallback(async () => {
    try {
      setTx({ status: "pending" })
      const hash = await writeContractAsync({
        address: campaignAddress,
        abi: campaignAbiTyped,
        functionName: "refund",
      })
      setTx({ status: "confirming", hash })
      return hash
    } catch (err: any) {
      setTx({ status: "error", error: err?.message || "Transaction failed" })
      throw err
    }
  }, [campaignAddress, writeContractAsync])

  return { refund, tx, setTx }
}

export function useCancel(campaignAddress: `0x${string}`) {
  const [tx, setTx] = useState<TransactionState>({ status: "idle" })
  const { writeContractAsync } = useWriteContract()

  const cancel = useCallback(async () => {
    try {
      setTx({ status: "pending" })
      const hash = await writeContractAsync({
        address: campaignAddress,
        abi: campaignAbiTyped,
        functionName: "cancel",
      })
      setTx({ status: "confirming", hash })
      return hash
    } catch (err: any) {
      setTx({ status: "error", error: err?.message || "Transaction failed" })
      throw err
    }
  }, [campaignAddress, writeContractAsync])

  return { cancel, tx, setTx }
}

export function useCreateCampaign() {
  const [tx, setTx] = useState<TransactionState>({ status: "idle" })
  const { writeContractAsync } = useWriteContract()

  const createCampaign = useCallback(async (
    metadataURI: string,
    goalUsd: bigint,
    minContributionUsd: bigint,
    deadline: bigint,
  ) => {
    try {
      setTx({ status: "pending" })
      const hash = await writeContractAsync({
        address: FACTORY_ADDRESS,
        abi: factoryAbiTyped,
        functionName: "createCampaign",
        args: [metadataURI, goalUsd, minContributionUsd, deadline],
      })
      setTx({ status: "confirming", hash })
      return hash
    } catch (err: any) {
      setTx({ status: "error", error: err?.message || "Transaction failed" })
      throw err
    }
  }, [writeContractAsync])

  return { createCampaign, tx, setTx }
}

export function useTransactionConfirm(hash: `0x${string}` | undefined) {
  return useWaitForTransactionReceipt({ hash, query: { enabled: !!hash } })
}

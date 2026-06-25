import { useState, useEffect, useCallback } from 'react'
import { useAppKit, useDisconnect } from '@reown/appkit/react'
import { useAccount, useWalletClient, useSwitchChain } from 'wagmi'
import { useSendCalls } from 'wagmi/experimental'
import { Attribution } from 'ox/erc8021'
import { getChainById } from '../wagmi'

const DATA_SUFFIX = Attribution.toDataSuffix({
  codes: ["bc_vl81sguo"],
})

export function useWallet() {
  const { open } = useAppKit()
  const { disconnect } = useDisconnect()
  const { address, isConnected, status: connectionStatus, chainId: connectedChainId } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { switchChainAsync } = useSwitchChain()
  const { sendCallsAsync, reset: resetBatchCalls } = useSendCalls()

  const [walletCapabilities, setWalletCapabilities] = useState({
    explicitDeposit: true,
    supportsAtomicBatch: true,
  })

  useEffect(() => {
    if (!isConnected || !walletClient || !address || !connectedChainId) return
    let isActive = true

    const resolveCapabilities = async () => {
      try {
        const { resolveExplicitDeposit } = await import('../bridgeService')
        const result = await resolveExplicitDeposit({
          walletClient,
          address,
          chainId: connectedChainId,
        })
        if (!isActive) return
        setWalletCapabilities({
          explicitDeposit: result.explicitDeposit ?? true,
          supportsAtomicBatch: result.supportsAtomicBatch ?? true,
        })
      } catch { /* ignore */ }
    }
    resolveCapabilities()
    return () => { isActive = false }
  }, [isConnected, walletClient, address, connectedChainId])

  const openWallet = useCallback(() => open(), [open])
  const openNetworks = useCallback(() => open({ view: 'Networks' }), [open])
  const disconnectWallet = useCallback(() => disconnect(), [disconnect])

  return {
    open, openWallet, openNetworks, disconnectWallet,
    disconnect, sendCallsAsync, resetBatchCalls,
    walletClient, switchChainAsync, address, isConnected,
    connectionStatus, connectedChainId, walletCapabilities, DATA_SUFFIX,
  }
}

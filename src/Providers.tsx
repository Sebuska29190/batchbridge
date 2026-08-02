import type { ReactNode } from 'react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { wagmiConfig } from './wagmi'

const queryClient = new QueryClient()

export function Providers({ children }: { children: ReactNode }) {
    return (
        // `wagmiConfig` comes from @reown/appkit-adapter-wagmi's own nested
        // @wagmi/core copy, which npm doesn't dedupe against the top-level one
        // `WagmiProvider`'s `config` prop is typed against - two structurally
        // identical but nominally distinct `Config` types. Runtime behavior is
        // unaffected; only the type-checker sees two packages.
        <WagmiProvider config={wagmiConfig as Parameters<typeof WagmiProvider>[0]['config']}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </WagmiProvider>
    )
}


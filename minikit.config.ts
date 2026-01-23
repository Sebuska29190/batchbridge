const ROOT_URL = 'https://batchbridge.vercel.app';

export const minikitConfig = {
  accountAssociation: {
    // ⚠️ WYMIENIĆ NA WYGENEROWANE CREDENTIALS Z BASE BUILD ACCOUNT ASSOCIATION TOOL
    // 1. Przejdź do: https://base.org/build/account-association
    // 2. Wprowadź URL: https://batchbridge.vercel.app
    // 3. Podpisz manifest swoim kontem Farcaster
    // 4. Skopiuj wygenerowane credentials i wklej poniżej:
    "header": "WYMIENIĆ_NA_WYGENEROWANY_HEADER",
    "payload": "WYMIENIĆ_NA_WYGENEROWANY_PAYLOAD",
    "signature": "WYMIENIĆ_NA_WYGENEROWANY_SIGNATURE"
  },
  miniapp: {
    version: "1",
    name: "BatchBridge",
    subtitle: "Batch Swap & Bridge Tokens",
    description: "Bridge multiple tokens across Ethereum, Base, and Arbitrum in a single batch transaction using Relay Protocol with EIP-5792 support.",
    screenshotUrls: [`${ROOT_URL}/screenshot-portrait.png`],
    iconUrl: `${ROOT_URL}/icon.png`,
    splashImageUrl: `${ROOT_URL}/hero.png`,
    splashBackgroundColor: "#000000",
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: "finance",
    tags: ["defi", "bridge", "swap", "batch", "tokens", "ethereum", "base", "arbitrum"],
    heroImageUrl: `${ROOT_URL}/hero.png`,
    tagline: "Batch swap and bridge tokens across chains",
    ogTitle: "BatchBridge - Multi-token Bridge",
    ogDescription: "Bridge multiple tokens across Ethereum, Base, and Arbitrum in a single batch transaction",
    ogImageUrl: `${ROOT_URL}/og-image.png`,
  },
} as const;
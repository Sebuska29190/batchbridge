const ROOT_URL = 'https://batchbridge.vercel.app';

export const minikitConfig = {
  accountAssociation: {
    // To będzie dodane w kroku 5 po wygenerowaniu credentials
    "header": "",
    "payload": "",
    "signature": ""
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
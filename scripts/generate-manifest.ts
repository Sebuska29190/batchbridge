import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { minikitConfig } from '../minikit.config.ts';

// Create .well-known directory if it doesn't exist
const wellKnownDir = join(process.cwd(), '.well-known');
if (!existsSync(wellKnownDir)) {
  mkdirSync(wellKnownDir, { recursive: true });
}

// Generate farcaster.json manifest
const farcasterManifest = {
  accountAssociation: minikitConfig.accountAssociation,
  frame: {
    version: minikitConfig.miniapp.version,
    name: minikitConfig.miniapp.name,
    iconUrl: minikitConfig.miniapp.iconUrl,
    homeUrl: minikitConfig.miniapp.homeUrl,
    imageUrl: minikitConfig.miniapp.heroImageUrl,
    buttonTitle: `Launch ${minikitConfig.miniapp.name}`
  }
};

// Write the manifest file
const manifestPath = join(wellKnownDir, 'farcaster.json');
writeFileSync(manifestPath, JSON.stringify(farcasterManifest, null, 2));

console.log(`✅ Manifest generated at: ${manifestPath}`);
console.log(`📱 App Name: ${minikitConfig.miniapp.name}`);
console.log(`🔗 Home URL: ${minikitConfig.miniapp.homeUrl}`);
console.log(`🖼️ Icon URL: ${minikitConfig.miniapp.iconUrl}`);
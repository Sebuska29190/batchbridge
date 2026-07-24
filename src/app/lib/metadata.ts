import type { Metadata } from 'next';
import { JUMPER_SITE_NAME } from '@/const/domain';
import { JUMPER_URL } from '@/const/urls';

export const siteName = JUMPER_SITE_NAME;

export const pageMetadataFields = {
  default: {
    title: 'BatchBridge | Multi-Chain DEX & Bridge',
    description:
      'Swap and bridge tokens across 20+ chains at the best rates. Cross-chain swaps, portfolio management, and DeFi in one app.',
  },
  earn: {
    title: 'BatchBridge Earn | Earn Across Chains',
    description:
      'Earn across chains with BatchBridge. Access DeFi earn opportunities and seamless swaps in one app.',
  },
  earnOpportunity: {
    title: 'BatchBridge Earn | {{opportunityName}}',
    description:
      'Earn across chains with BatchBridge. Access DeFi earn opportunities and seamless swaps in one app.',
  },
  portfolio: {
    title: 'BatchBridge Portfolio | Multi-Chain Overview',
    description:
      'Cross-chain portfolio aggregation with BatchBridge. Track all your assets in one app.',
  },
  profile: {
    title: 'BatchBridge Profile',
    description:
      'BatchBridge user profile and loyalty pass.',
  },
};

export const pageOpenGraph: Record<string, Metadata['openGraph']> = {
  default: {
    title: pageMetadataFields.default.title,
    description: pageMetadataFields.default.description,
    images: [
      {
        url: `${JUMPER_URL}/preview-default.png`,
        width: 900,
        height: 450,
      },
    ],
    type: 'website',
    siteName,
  },
  earn: {
    title: pageMetadataFields.earn.title,
    description: pageMetadataFields.earn.description,
    images: [
      {
        url: `${JUMPER_URL}/preview-earn.png`,
        width: 900,
        height: 450,
      },
    ],
    type: 'website',
    siteName,
  },
  earnOpportunity: {
    title: pageMetadataFields.earnOpportunity.title,
    description: pageMetadataFields.earnOpportunity.description,
    images: [
      {
        url: `${JUMPER_URL}/preview-earn.png`,
        width: 900,
        height: 450,
      },
    ],
    type: 'website',
    siteName,
  },
  portfolio: {
    title: pageMetadataFields.portfolio.title,
    description: pageMetadataFields.portfolio.description,
    images: [
      {
        url: `${JUMPER_URL}/preview-portfolio.png`,
        width: 900,
        height: 450,
      },
    ],
    type: 'website',
    siteName,
  },
  profile: {
    title: pageMetadataFields.profile.title,
    description: pageMetadataFields.profile.description,
    images: [
      {
        url: `${JUMPER_URL}/preview-profile.png`,
        width: 900,
        height: 450,
      },
    ],
    type: 'website',
    siteName,
  },
};

export const pageTwitter: Record<string, Metadata['twitter']> = {
  default: {
    site: '@BatchBridge',
    title: pageMetadataFields.default.title,
    description: pageMetadataFields.default.description,
    images: `${JUMPER_URL}/preview-default.png`,
  },
  earn: {
    site: '@BatchBridge',
    title: pageMetadataFields.earn.title,
    description: pageMetadataFields.earn.description,
    images: `${JUMPER_URL}/preview-earn.png`,
  },
  earnOpportunity: {
    site: '@BatchBridge',
    title: pageMetadataFields.earnOpportunity.title,
    description: pageMetadataFields.earnOpportunity.description,
  },
  portfolio: {
    site: '@BatchBridge',
    title: pageMetadataFields.portfolio.title,
    description: pageMetadataFields.portfolio.description,
    images: `${JUMPER_URL}/preview-portfolio.png`,
  },
  profile: {
    site: '@BatchBridge',
    title: pageMetadataFields.profile.title,
    description: pageMetadataFields.profile.description,
    images: `${JUMPER_URL}/preview-profile.png`,
  },
};

export const baseMiniApp = {
  splashBackgroundColor: '#0d1117',
  iconUrl: `${JUMPER_URL}/mini-app-icon.png`,
  screenshotIcons: [
    `${JUMPER_URL}/mini-app-screenshot-1.png`,
    `${JUMPER_URL}/mini-app-screenshot-2.png`,
    `${JUMPER_URL}/mini-app-screenshot-3.png`,
  ],
  splashImageUrl: `${JUMPER_URL}/favicon.png`,
  miniAppName: 'BatchBridge',
};

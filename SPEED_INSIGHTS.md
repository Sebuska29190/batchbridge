# Speed Insights Integration Guide

This guide documents how Vercel Speed Insights is implemented in the BatchBridge project.

## Overview

BatchBridge uses [Vercel Speed Insights](https://vercel.com/docs/speed-insights) to monitor and track performance metrics. Speed Insights provides real-time Web Vitals monitoring for your application.

## Current Implementation

### Prerequisites

- Vercel account with Speed Insights enabled
- `@vercel/speed-insights` package installed (already configured in `frontend/package.json`)
- Project deployed on Vercel

### Package Installation

The `@vercel/speed-insights` package is already installed in the project:

```bash
npm install @vercel/speed-insights
```

Or with your preferred package manager:

```bash
# pnpm
pnpm i @vercel/speed-insights

# yarn
yarn add @vercel/speed-insights

# bun
bun add @vercel/speed-insights
```

### Implementation Details

The `SpeedInsights` component from `@vercel/speed-insights/react` is integrated in the main App component:

**File:** `frontend/src/App.jsx`

```jsx
import { SpeedInsights } from '@vercel/speed-insights/react'

export default function App() {
    // ... component code ...
    
    return (
        <div className="container">
            {/* App content */}
            <SpeedInsights />
        </div>
    )
}
```

#### Why React Import Path?

We use the React import path (`@vercel/speed-insights/react`) because:
- This is a React application using Vite
- The package provides a wrapper around the tracking script with seamless React integration
- It handles automatic pathname tracking for route changes

## Enabling Speed Insights in Vercel

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project (BatchBridge)
3. Navigate to the **Speed Insights** tab
4. Click **Enable** in the dialog

> **Note:** Enabling Speed Insights will add new routes (scoped at `/_vercel/speed-insights/*`) after your next deployment.

## Environment Variables

Speed Insights requires no additional environment variables to be configured. The tracking is automatically handled once:
1. The package is installed
2. The `<SpeedInsights />` component is added
3. The project is deployed to Vercel

## Deployment

The Speed Insights tracking will automatically begin when:
1. Your application is deployed to Vercel
2. Users visit your site
3. Real user data is collected in the background

After a few days of visitors, you'll be able to view performance metrics in the Vercel Dashboard under the **Speed Insights** tab.

## Viewing Your Data

To view Speed Insights metrics:

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select the BatchBridge project
3. Click the **Speed Insights** tab
4. Explore metrics like:
   - **Largest Contentful Paint (LCP)** - Loading performance
   - **First Input Delay (FID)** / **Interaction to Next Paint (INP)** - Interactivity
   - **Cumulative Layout Shift (CLS)** - Visual stability

## What Gets Tracked

The `@vercel/speed-insights` package automatically tracks:
- Web Vitals (LCP, FID/INP, CLS)
- Navigation timings
- Resource timings
- HTTP status codes
- Route information

All data is collected in real-time from users visiting your application.

## Privacy and Data Compliance

Speed Insights is designed with privacy in mind:
- Data is aggregated and anonymized
- No personally identifiable information is collected
- Complies with GDPR and other privacy standards
- Learn more: [Speed Insights Privacy Policy](https://vercel.com/docs/speed-insights/privacy-policy)

## Performance Optimization Tips

Based on Speed Insights metrics, consider:

1. **Improve LCP (Largest Contentful Paint)**
   - Optimize image sizes
   - Minimize CSS blocking
   - Reduce server response time

2. **Reduce INP (Interaction to Next Paint)**
   - Minimize JavaScript execution time
   - Break up long tasks
   - Use React.memo for expensive components

3. **Maintain Low CLS (Cumulative Layout Shift)**
   - Reserve space for images and videos
   - Avoid inserting content above existing content
   - Use `size` attribute on images

## Custom Routing (If Needed)

For Next.js 13.5+ (in older React setups), you can pass route information:

```jsx
import { SpeedInsights } from '@vercel/speed-insights/react'

export default function App() {
    // Route information is automatically detected in Next.js App Router
    return <SpeedInsights />
}
```

## Troubleshooting

### Speed Insights Not Showing Data

1. **Verify Script Installation**
   ```bash
   # Check that the speed-insights endpoint is accessible
   # Look for /_vercel/speed-insights/script.js in browser DevTools
   ```

2. **Check Package Version**
   ```bash
   npm list @vercel/speed-insights
   ```

3. **Ensure Component is Added**
   - Verify `<SpeedInsights />` is in your main App component
   - Check that it's not conditionally rendered in a way that prevents loading

4. **Allow Time for Data**
   - Initial data collection takes a few days
   - Ensure your site has real user traffic

5. **Check Vercel Dashboard**
   - Confirm Speed Insights is enabled on your project
   - Verify project deployment is recent

## Additional Resources

- [Speed Insights Documentation](https://vercel.com/docs/speed-insights)
- [Web Vitals Guide](https://web.dev/vitals/)
- [Core Web Vitals Report](https://vercel.com/docs/speed-insights/metrics)
- [Speed Insights Troubleshooting](https://vercel.com/docs/speed-insights/troubleshooting)

## Local Development

Speed Insights only collects data in production deployments. During local development:

```bash
cd frontend
npm run dev
```

No Speed Insights tracking occurs locally. To test locally, you would need to build and deploy to Vercel.

## Building and Deploying

The current setup in `vercel.json` is configured to:
- Build from `frontend/` directory
- Output to `frontend/dist`
- Deploy using Vite

To deploy:

```bash
# Via Vercel CLI
vercel deploy

# Or connect your git repository to Vercel for automatic deployments
```

Speed Insights will automatically start collecting data after deployment.

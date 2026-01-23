# Base Mini App Integration Instructions - Vercel Deployment

## Step 1: Disable Deployment Protection in Vercel

For the Base Build Account association tool to access your manifest, you need to disable Deployment Protection (Vercel Authentication).

### Procedure:

1. **Log in to Vercel Dashboard** (https://vercel.com)
2. **Select the "batchbridge" project** from the project list
3. **Go to Settings** → **Deployment Protection**
4. **Disable "Vercel Authentication"**:
   - Find the "Vercel Authentication" toggle
   - Switch it to OFF (disabled)
   - Click "Save" to save changes

### Note:
- Disabling Vercel Authentication allows the Base Build Account association tool to access `.well-known/farcaster.json` without authentication
- After completing the association process, you can re-enable protection

## Step 2: Verify application is publicly available

Before generating credentials, make sure:
1. The application is deployed on Vercel at: `https://batchbridge.vercel.app`
2. The manifest is available at: `https://batchbridge.vercel.app/.well-known/farcaster.json`
3. Images are available at:
   - `https://batchbridge.vercel.app/icon.png`
   - `https://batchbridge.vercel.app/hero.png`
   - `https://batchbridge.vercel.app/screenshot-portrait.png`

## Step 3: Generate accountAssociation credentials

After disabling Deployment Protection, go to:
1. **Base Build Account association tool**: https://base.org/build/account-association
2. **Enter App URL**: `https://batchbridge.vercel.app`
3. **Click "Submit"**
4. **Sign the manifest** according to instructions
5. **Copy the generated `accountAssociation` object**

## Step 4: Update configuration

After obtaining credentials:
1. Update `minikit.config.ts` with the generated data
2. Deploy changes to production
3. Test in `base.dev/preview`

## Troubleshooting:

If you encounter issues:
1. **403 Forbidden**: Make sure Vercel Authentication is disabled
2. **404 Not Found**: Check if `.well-known/farcaster.json` exists in build output
3. **CORS errors**: Check headers configuration in `vercel.json`
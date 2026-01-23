# Deployment Instructions for Production

After updating `minikit.config.ts` with `accountAssociation` credentials, you need to deploy the changes to production (Vercel).

## Step 1: Check changes before deployment

Make sure all changes are ready:

1. ✅ `minikit.config.ts` - updated with credentials
2. ✅ `.well-known/farcaster.json` - updated manifest (or ready to be generated)
3. ✅ All new image files are in `frontend/public/`

Check the status of changes:
```bash
git status
```

You should see modified/new files:
- `minikit.config.ts`
- `.well-known/farcaster.json` (or script to generate it)
- `INSTRUCTIONS_*.md` (instruction files)
- `package.json` (new in root directory)
- `scripts/generate-manifest.ts`

## Step 2: Commit changes

Add changes to git and commit:

```bash
# Add all changed files
git add .

# Commit with a meaningful message
git commit -m "feat: Add Base Mini App configuration with accountAssociation credentials"

# Or if you want to split into smaller commits:
git add minikit.config.ts .well-known/farcaster.json
git commit -m "feat: Update minikit.config.ts with accountAssociation credentials"
```

## Step 3: Push to main branch

Push changes to the main branch (usually `main` or `master`):

```bash
git push origin main
```

## Step 4: Monitor deployment on Vercel

After pushing, Vercel will automatically start deployment:

1. **Open Vercel Dashboard**: https://vercel.com
2. **Go to the "batchbridge" project**
3. **Check the "Deployments" tab**
4. **Monitor deployment progress**

Deployment time usually takes 1-3 minutes.

## Step 5: Deployment verification

After deployment completes, verify everything works:

### Test 1: Check manifest availability
Open in browser:
```
https://batchbridge.vercel.app/.well-known/farcaster.json
```

You should see correct JSON with `accountAssociation` credentials.

### Test 2: Check image availability
Check if images are available:
- `https://batchbridge.vercel.app/icon.png`
- `https://batchbridge.vercel.app/hero.png`
- `https://batchbridge.vercel.app/screenshot-portrait.png`

### Test 3: Check main application
Open the main application:
```
https://batchbridge.vercel.app
```

Make sure the application works correctly.

## Step 6: (Optional) Re-enable Deployment Protection

If you want to secure your deployment:

1. **Go to Vercel Dashboard** → **Settings** → **Deployment Protection**
2. **Enable "Vercel Authentication"** (toggle ON)
3. **Click "Save"**

**Note**: After enabling Vercel Authentication, the Base Build Account association tool may have issues with verification in the future. Leave it disabled if you plan frequent manifest updates.

## Deployment troubleshooting:

### Problem: "Build failed"
- Check deployment logs in Vercel
- Make sure `package.json` in root directory doesn't conflict with `frontend/package.json`
- Check if TypeScript compiles correctly

### Problem: "Manifest not found after deployment"
- Check if `.well-known/farcaster.json` is in the output directory
- Check `vercel.json` configuration - if `headers` are correctly configured
- Check if the file was properly copied during build process

### Problem: "CORS errors"
- Check headers configuration in `vercel.json`
- Make sure `Access-Control-Allow-Origin` is set to `*` for `.well-known/*`

## Step 7: After successful deployment

After successful deployment:
1. **Note the deployment version** from Vercel Dashboard
2. **Test in `base.dev/preview`** (next step)
3. **Notify the team** about successful deployment

## Automatic deployments:

Vercel automatically deploys on every push to `main`. If you want to control when to deploy:
1. Use feature branches
2. Use Vercel's "Promote to Production"
3. Configure deployment rules in Vercel Settings
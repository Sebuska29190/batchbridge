# Instructions for Testing in base.dev/preview

After deploying changes to production, test your application in the Base Preview tool.

## Step 1: Open Base Preview

Go to: **https://base.dev/preview**

## Step 2: Add application URL

In the "Enter your app URL" field, enter:
```
https://batchbridge.vercel.app
```

Click "Preview" or press Enter.

## Step 3: Review tabs

Base Preview has several tabs for verification:

### "Preview" tab
- **Embed preview**: See how your application will look as an embed in Farcaster
- **Launch button**: Click "Launch" to open the application in preview
- **Check if**:
  - Images load correctly (icon, hero)
  - Title and description are correct
  - Application launches without errors

### "Metadata" tab
- **Manifest verification**: Check if all manifest fields are correctly loaded
- **Check for missing fields**:
  - `name`, `iconUrl`, `homeUrl` - required
  - `screenshotUrls`, `heroImageUrl` - recommended
  - `description`, `subtitle` - for better UX
- **Warnings**: Fix all metadata warnings

### "Account association" tab
- **Credentials verification**: Check if `accountAssociation` credentials are correct
- **Status**: Should show "Verified" or similar confirming status
- **If error**: Check if credentials are identical to generated ones

### "Frame validation" tab (if applicable)
- If the application has a Farcaster Frame, check validation here

## Step 4: Testing application launch

1. **Click "Launch"** in the Preview tab
2. **Check if the application loads correctly**
3. **Test basic functions**:
   - Wallet connection
   - Token selection
   - Quote generation
   - (Optional) transaction testing

## Step 5: Testing on different devices

Base Preview allows testing different viewports:

1. **Mobile view**: Check responsiveness on mobile
2. **Desktop view**: Check appearance on desktop
3. **Tablet view**: Check appearance on tablet

## Step 6: Checking console errors

Open DevTools (F12) and check:
1. **Console tab**: If there are any JavaScript errors
2. **Network tab**: If all resources load correctly
3. **CORS errors**: If there are no CORS errors when loading manifest

## Common problems and solutions:

### Problem: "Invalid manifest"
- Check if `.well-known/farcaster.json` is valid JSON
- Check if all required fields are present
- Check if image URLs are accessible

### Problem: "Account association failed"
- Check if credentials in `minikit.config.ts` and `.well-known/farcaster.json` are identical
- Check if you're using the same Farcaster account as when generating
- Try generating credentials again

### Problem: "Images not loading"
- Check if images are accessible at the provided URLs
- Check image sizes (recommended):
  - Icon: 512x512px
  - Hero: 1200x630px
  - Screenshot: 1080x1920px (portrait)
- Check format (PNG recommended)

### Problem: "App not launching properly"
- Check if the main application works at `https://batchbridge.vercel.app`
- Check if there are no JavaScript errors
- Check if wallet connects correctly in embed

## Step 7: Collect feedback and note problems

During testing, note:
1. **What works well**
2. **Problems to fix**
3. **Improvement suggestions**
4. **Console errors**

## Step 8: Iterative fixes

If you find problems:
1. **Fix problems** locally
2. **Deploy fixes** to production
3. **Test again** in base.dev/preview
4. **Repeat** until all tests pass

## Step 9: Final verification

Before announcing the application as ready, make sure:
- ✅ All tabs in Base Preview show "Verified" or "Success"
- ✅ Application launches without errors
- ✅ Images load correctly
- ✅ Manifest is complete
- ✅ Account association is verified

## Additional tests:

### Test on different browsers:
- Chrome/Chromium
- Firefox
- Safari (if possible)

### Test with different wallets:
- MetaMask
- Coinbase Wallet
- Rabby
- Others supported by your application

After successfully passing all tests, your application is ready to use as a Base Mini App!
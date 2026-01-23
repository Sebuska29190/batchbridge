# Generating accountAssociation Credentials Instructions

## Prerequisites:
1. ✅ Project deployed on Vercel: `https://batchbridge.vercel.app`
2. ✅ Vercel Authentication disabled (Deployment Protection)
3. ✅ Manifest available: `https://batchbridge.vercel.app/.well-known/farcaster.json`

## Step 1: Go to Base Build Account association tool

Open your browser and go to:
**https://base.org/build/account-association**

## Step 2: Enter your app URL

In the "App URL" field enter:
```
https://batchbridge.vercel.app
```

## Step 3: Click "Submit"

After entering the URL click the **"Submit"** button.

## Step 4: Sign the manifest

The system will display a request to sign the manifest:

1. **Connect your wallet** (if not already connected)
2. **Select your Farcaster account** that you want to associate with the app
3. **Sign the message** in your wallet
4. **Confirm signing** the transaction

## Step 5: Copy the generated credentials

After successful signing, you'll see the generated `accountAssociation` object:

```json
{
  "header": "eyJmaWQiOjE3MzE4LCJ0eXBlIjoiY3VzdG9keSIsImtleSI6IjB4NzYwQjA0NDc5NjM4MTExNzNmRjg3YjAzYzA5OEJBQ0YxNzNCYkU0OCJ9",
  "payload": "eyJkb21haW4iOiJ4LWl0bGlzdC1xcy52ZXJjZWwuYXBwIn0",
  "signature": "0xf4d37c6998420d3ceeca3b89ec2d2009920108ea51eab76027d22c505a7221f654bbdefd44d09cbcc66b67f4ff2ff8f345c85f6d7e5c7279cf0f8e068633acf1b"
}
```

**IMPORTANT**: Copy the ENTIRE object with exactly the same values.

## Step 6: Verification

Click the **"Verify"** button that appears to confirm that credentials were generated correctly.

## Troubleshooting:

### Problem: "Failed to fetch manifest"
- Check if `.well-known/farcaster.json` is publicly available
- Check if Vercel Authentication is disabled
- Check browser console for CORS errors

### Problem: "Invalid signature"
- Make sure you signed the message with the correct Farcaster account
- Try again with a different account

### Problem: "Domain verification failed"
- Make sure you're using exactly the same URL as your deployed app
- Check if DNS is correctly configured

## What's Next?

After obtaining credentials:
1. Update `minikit.config.ts` with the generated data
2. Deploy changes to production
3. Test in `base.dev/preview`
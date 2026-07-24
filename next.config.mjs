/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@lifi/widget', '@lifi/wallet-management', '@lifi/widget-provider'],
}

export default nextConfig

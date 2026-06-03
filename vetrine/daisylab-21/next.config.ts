import type { NextConfig } from 'next'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const nextConfig: NextConfig = {
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'zfwlkvqxfzvubmfyxofs.supabase.co' },
    ],
  },
}

export default nextConfig

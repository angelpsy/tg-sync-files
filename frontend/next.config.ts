import { config } from 'dotenv';
import { resolve } from 'path';
import type { NextConfig } from 'next';

// Load environment variables from root .env file
config({ path: resolve(__dirname, '../.env') });

const nextConfig: NextConfig = {
  eslint: {
    dirs: ['app', 'lib', 'components'],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;

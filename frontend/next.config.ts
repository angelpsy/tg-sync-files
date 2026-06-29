import { resolve } from 'path';

import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import type { NextConfig } from 'next';

// Load environment variables from root .env file and expand nested vars
const env = config({ path: resolve(__dirname, '../.env') });
expand(env);

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;

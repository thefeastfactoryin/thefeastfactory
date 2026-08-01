import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: [
    '@aranyam/api-client',
    '@aranyam/shared-types',
  ],
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  images: { unoptimized: true },
  trailingSlash: true,
  outputFileTracingRoot: __dirname,
  // 部署构建时尽量避免卡在 “Linting / Type checking” 阶段（可在本地开发机单独运行 npm run lint / tsc）
  eslint: {
    ignoreDuringBuilds: true
  },
  typescript: {
    ignoreBuildErrors: true
  },
  experimental: {
    webpackBuildWorker: false,
    cpus: 1
  }
};

module.exports = nextConfig;

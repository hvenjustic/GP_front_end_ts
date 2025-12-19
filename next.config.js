/** @type {import('next').NextConfig} */
const nextConfig = {
  // 需要运行时动态渲染 result/detail，不能用静态导出
  output: 'standalone',
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

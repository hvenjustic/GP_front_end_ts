/** @type {import('next').NextConfig} */
const nextConfig = {
  // 动态页面不做静态导出；使用标准 server 输出并关闭 tracing 以避免构建卡在 Collecting build traces
  output: 'server',
  reactStrictMode: true,
  images: { unoptimized: true },
  trailingSlash: true,
  outputFileTracing: false,
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

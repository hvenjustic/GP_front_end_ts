/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  images: { unoptimized: true },
  outputFileTracingRoot: __dirname,
  experimental: {
    webpackBuildWorker: false,
    cpus: 1
  }
};

module.exports = nextConfig;

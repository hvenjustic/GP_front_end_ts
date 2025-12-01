/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  images: { unoptimized: true },
  experimental: {
    webpackBuildWorker: false,
    cpus: 1
  }
};

module.exports = nextConfig;

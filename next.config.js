/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverComponentsExternalPackages: ['pg', 'bcryptjs'] },
};
module.exports = nextConfig;

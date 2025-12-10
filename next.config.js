const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://api.thekevinstaxlab.com/:path*', // 프론트와 API 도메인 통일처럼 동작
      },
    ];
  },
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "kevintax.s3.ap-northeast-2.amazonaws.com",
      },
    ],
  },
};

module.exports = nextConfig;
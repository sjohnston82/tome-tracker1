import type { NextConfig } from "next";
import withPWA from "next-pwa";

const withPWAConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/covers\.openlibrary\.org\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "cover-images",
        expiration: {
          maxEntries: 500,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
    {
      urlPattern: /^https:\/\/books\.google\.com\/books\/content.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "google-covers",
        expiration: {
          maxEntries: 500,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
    {
      urlPattern: /\/api\/library\/sync/,
      handler: "NetworkFirst",
      options: {
        cacheName: "library-sync",
        networkTimeoutSeconds: 10,
        expiration: {
          maxAgeSeconds: 60 * 60 * 24,
        },
      },
    },
  ],
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
};

export default withPWAConfig(nextConfig);

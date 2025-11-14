/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/',
  },
}

module.exports = nextConfig
client/next-env.d.ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/basic-features/typescript for more information.
client/.gitignore
See https://help.github.com/articles/ignoring-files/ for more about ignoring files.
dependencies
/node_modules
/.pnp
.pnp.js

testing
/coverage

next.js
/.next/
/out/

production
/build

misc
.DS_Store
.pem

debug
npm-debug.log
yarn-debug.log*
yarn-error.log*

local env files
.env*.local
.env

vercel
.vercel

typescript
*.tsbuildinfo
next-env.d.ts
client/.env.local
client/.env
NEXT_PUBLIC_API_URL=http://localhost:5000/

# Architecture

The application is a Next.js 15 App Router deployment. Server components and
route handlers use Prisma against PostgreSQL; browser code never receives
database, Redis, SMTP, or object-storage credentials.

## Production services

- Vercel runs the Next.js application and route handlers.
- Hosted PostgreSQL is used through `DATABASE_URL` (pooled runtime connection)
  and `DIRECT_URL` (migration/direct connection).
- Upstash Redis is selected when both `UPSTASH_REDIS_REST_URL` and
  `UPSTASH_REDIS_REST_TOKEN` are configured. Local ioredis remains supported.
- Storage uses the existing S3-compatible abstraction with Supabase Storage as
  the hosted provider.
- Clerk owns authentication and authentication email. The application does not
  send transactional email.

## Serverless rules

Uploads use short-lived presigned URLs and never pass image bytes through a
Vercel function. Prisma and local Redis clients are process singletons.
Production migrations are run manually with `prisma migrate deploy`, never as a
build side effect.

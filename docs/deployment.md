# Deployment

## Hosted services

Use hosted services for development, preview, and production; Docker is not
required. Supabase can provide PostgreSQL and S3-compatible Storage, and Upstash
provides Redis. Clerk provides authentication and authentication email.

Create separate development, preview, and production databases where the
provider supports branches or projects.
Configure the pooled connection in `DATABASE_URL` and the unpooled/direct
connection in `DIRECT_URL`. Run migrations from a controlled environment:

```bash
npx prisma migrate deploy
```

Never use `migrate reset` or destructive `db push` against a shared or
production database.

## Vercel

Set environment variables separately for Development, Preview, and Production.
Do not copy production database, Redis, storage, or authentication secrets to
Preview. Build with `npm run build`; migrations are a separate release step.
Use the hosted-service placeholders in [`env.example`](../env.example).
`DATABASE_URL` is pooled for serverless requests, while `DIRECT_URL` is
unpooled for Prisma migrations. They are not two databases.

## Storage

Create a public Supabase Storage bucket named `uploads`, then provide its S3
endpoint, region, access keys, and public object URL through the existing
`S3_*` variables. Do not expose those variables with `NEXT_PUBLIC_`.

## Rollback

Revert the application deployment in Vercel, preserve database records, and
restore the prior environment-variable set. Database migrations must be
reviewed and rolled forward with a corrective migration; do not reset data.

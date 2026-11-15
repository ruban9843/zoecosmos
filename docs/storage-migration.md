# Storage migration

Product image bytes remain outside PostgreSQL. `ProductImage` stores the public
URL and the S3 object key, allowing reliable deletion. Upload authorization is
server-side, MIME types are constrained, and uploads are limited to 10 MiB.
Objects receive immutable one-year cache headers.

## Supabase Storage

Create a public bucket named `uploads` and enable S3 access in the Supabase
dashboard. Configure the S3 endpoint, region, access keys, and public object
URL in the `S3_*` environment variables. Keep the bucket public because the
application stores public image URLs in product records.

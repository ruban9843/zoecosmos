/**
 * S3-compatible storage helpers.
 * Works with S3-compatible providers such as Supabase Storage, R2, and AWS.
 */
import { DeleteObjectCommand, S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "crypto";

let _client: S3Client | null = null;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function client() {
  if (_client) return _client;
  _client = new S3Client({
    region: process.env.AWS_REGION || process.env.S3_REGION || "us-east-1",
    endpoint: ENDPOINT || undefined,
    forcePathStyle: !!ENDPOINT,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY || "",
    },
  });
  return _client;
}

const ENDPOINT = process.env.AWS_ENDPOINT_URL_S3 || process.env.S3_ENDPOINT || "";
const BUCKET = process.env.S3_BUCKET || "uploads";
const PUBLIC = process.env.S3_PUBLIC_URL || (ENDPOINT ? `${ENDPOINT}/${BUCKET}` : "");

/**
 * Generate a signed PUT URL the browser can upload directly to.
 * Returns the upload URL + the public-facing URL the image will live at.
 */
export async function createSignedUploadUrl(opts: {
  contentType: string;
  contentLength: number;
  prefix?: string;
}) {
  if (opts.contentLength < 1 || opts.contentLength > MAX_IMAGE_BYTES) {
    throw new Error(`Image must be between 1 byte and ${MAX_IMAGE_BYTES} bytes`);
  }
  const ext = (opts.contentType.split("/")[1] || "bin").replace(/[^a-z0-9]/gi, "");
  const key = `${opts.prefix || "uploads"}/${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: opts.contentType,
    ContentLength: opts.contentLength,
    CacheControl: "public, max-age=31536000, immutable",
  });
  const uploadUrl = await getSignedUrl(client(), cmd, { expiresIn: 60 * 5 });
  const publicUrl = PUBLIC ? `${PUBLIC}/${key}` : key;
  return { uploadUrl, publicUrl, key };
}

export async function deleteObject(key: string | null | undefined) {
  if (!key) return;
  await client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

import { z } from "zod";
import { json, route, readBody } from "../../../../lib/api";
import { requireStaff } from "../../../../lib/auth-helpers";
import { createSignedUploadUrl, MAX_IMAGE_BYTES } from "../../../../lib/upload";

const schema = z.object({
  contentType: z.string().regex(/^image\/(png|jpe?g|webp|avif|gif)$/i, "Images only"),
  contentLength: z.number().int().positive().max(MAX_IMAGE_BYTES),
  prefix: z
    .string()
    .regex(/^[a-z0-9/_-]{1,60}$/i, "Invalid prefix")
    .optional(),
});

/**
 * POST /api/admin/upload-url — signed S3 PUT URL for product photography.
 * The browser PUTs the file straight to storage; only publicUrl is persisted.
 */
export const POST = route(async (req: Request) => {
  await requireStaff();
  const data = await readBody(req, schema);
  const result = await createSignedUploadUrl({
    contentType: data.contentType,
    contentLength: data.contentLength,
    prefix: data.prefix || "products",
  });
  return json(result);
});

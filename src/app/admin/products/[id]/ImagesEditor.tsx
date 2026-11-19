"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Image = { id: string; url: string; alt: string | null; isPrimary: boolean; sortOrder: number };

const MAX_EDGE = 1600;

/** Downscale large photos in the browser so the storefront never serves multi-MB originals. */
async function shrink(file: File): Promise<Blob> {
  if (file.type === "image/gif" || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

async function errorOf(res: Response, fallback: string) {
  return (await res.json().catch(() => ({}))).error || fallback;
}

export default function ImagesEditor({ productId, images }: { productId: string; images: Image[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [alts, setAlts] = useState<Record<string, string>>({});

  const uploadOne = async (file: File) => {
    const body = await shrink(file);
    const contentType = body.type || file.type;
    const signRes = await fetch("/api/admin/upload-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentType, contentLength: body.size, prefix: `products/${productId}` }),
    });
    if (!signRes.ok) throw new Error(await errorOf(signRes, "Could not sign upload"));
    const { uploadUrl, publicUrl, key } = await signRes.json();

    const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": contentType }, body });
    if (!putRes.ok) throw new Error("Upload to storage failed");

    const attachRes = await fetch(`/api/admin/products/${productId}/images`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: publicUrl, objectKey: key }),
    });
    if (!attachRes.ok) throw new Error(await errorOf(attachRes, "Could not save image"));
  };

  const upload = async (files: File[]) => {
    setError("");
    try {
      for (let i = 0; i < files.length; i++) {
        setUploading(`Uploading ${i + 1}/${files.length}…`);
        await uploadOne(files[i]);
      }
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(null);
      if (fileInput.current) fileInput.current.value = "";
      router.refresh();
    }
  };

  const mutate = async (imageId: string, init: RequestInit, fallback: string) => {
    setBusyId(imageId);
    setError("");
    const res = await fetch(`/api/admin/products/${productId}/images/${imageId}`, init);
    setBusyId(null);
    if (!res.ok) return setError(await errorOf(res, fallback));
    router.refresh();
  };

  const patch = (imageId: string, body: object) =>
    mutate(imageId, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, "Could not update photo");

  const remove = (imageId: string) => {
    if (!confirm("Remove this photo? It is deleted from storage too.")) return;
    mutate(imageId, { method: "DELETE" }, "Could not remove photo");
  };

  const move = async (index: number, dir: -1 | 1) => {
    const order = images.map((i) => i.id);
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    setBusyId(images[index].id);
    setError("");
    const res = await fetch(`/api/admin/products/${productId}/images`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order }),
    });
    setBusyId(null);
    if (!res.ok) return setError(await errorOf(res, "Could not reorder photos"));
    router.refresh();
  };

  return (
    <div>
      {error && <div className="ad-alert ad-alert--error">{error}</div>}
      <div className="ad-images-grid">
        {images.map((img, i) => {
          const alt = alts[img.id] ?? img.alt ?? "";
          const busy = busyId === img.id;
          return (
            <div key={img.id} className="ad-image-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.alt || ""} loading="lazy" />
              {img.isPrimary && <span className="ad-image-badge">Primary</span>}
              <input
                className="ad-input ad-image-alt"
                placeholder="Alt text"
                aria-label="Alt text"
                value={alt}
                maxLength={200}
                onChange={(e) => setAlts((a) => ({ ...a, [img.id]: e.target.value }))}
                onBlur={() => { if (alt !== (img.alt ?? "")) patch(img.id, { alt: alt || null }); }}
              />
              <div className="ad-image-actions">
                <button className="ad-btn ad-btn--sm" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="Move left">←</button>
                <button className="ad-btn ad-btn--sm" disabled={busy || i === images.length - 1} onClick={() => move(i, 1)} aria-label="Move right">→</button>
                {!img.isPrimary && (
                  <button className="ad-btn ad-btn--sm" style={{ flex: 1 }} disabled={busy} onClick={() => patch(img.id, { isPrimary: true })}>
                    Primary
                  </button>
                )}
                <button className="ad-btn ad-btn--sm ad-btn--danger" disabled={busy} onClick={() => remove(img.id)} aria-label="Remove photo">✕</button>
              </div>
            </div>
          );
        })}
      </div>

      <input
        ref={fileInput}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
        style={{ display: "none" }}
        onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length) upload(files); }}
      />
      <button type="button" className="ad-btn ad-btn--sm" disabled={!!uploading} onClick={() => fileInput.current?.click()}>
        {uploading || "Add photos"}
      </button>
    </div>
  );
}

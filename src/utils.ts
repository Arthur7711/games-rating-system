export const uid = () =>
  crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);

const MAX_SIDE = 400;

/** Downscale big photos so IndexedDB stays small and the UI stays fast. */
export async function shrinkImage(blob: Blob): Promise<Blob> {
  try {
    if (blob.type === "image/gif" || blob.type === "image/svg+xml") return blob; // keep animation / vectors
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    if (scale === 1 && blob.size < 300_000) {
      bmp.close();
      return blob;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.88));
    return out ?? blob;
  } catch {
    return blob;
  }
}

/** Index at which a new item dropped at (x, y) should be inserted inside a wrapping container. */
export function indexAtPoint(container: Element, x: number, y: number): number {
  const children = [...container.querySelectorAll<HTMLElement>("[data-item-id]")];
  for (let i = 0; i < children.length; i++) {
    const r = children[i].getBoundingClientRect();
    if (y < r.top) return i;
    if (y <= r.bottom && x < r.left + r.width / 2) return i;
  }
  return children.length;
}

/** Try to get an image URL out of something dragged from another web page. */
export function extractImageUrl(dt: DataTransfer | null): string | null {
  if (!dt) return null;
  const html = dt.getData("text/html");
  const m = html?.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m) return m[1];
  const uri = (dt.getData("text/uri-list") || dt.getData("text/plain")).trim();
  if (/^(https?:|data:image)/i.test(uri)) return uri.split("\n")[0];
  return null;
}

export async function fetchImage(url: string): Promise<Blob> {
  const res = await fetch(url);
  const blob = await res.blob();
  if (!blob.type.startsWith("image/")) throw new Error("not an image");
  return blob;
}

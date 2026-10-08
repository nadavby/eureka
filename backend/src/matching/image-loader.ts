import fs from "fs/promises";
import path from "path";
import { config } from "../lib/config";

export interface ImageData {
  mimeType: string;
  /** base64 */
  data: string;
}

const MAX_BYTES = 8 * 1024 * 1024;
const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

const publicRoot = () => path.resolve(process.cwd(), "public");

/** Loads an item photo as base64. Our own uploads are read from disk, other URLs are fetched. */
export const loadImage = async (url: string): Promise<ImageData> => {
  const localPrefix = `${config.DOMAIN_BASE}/public/`;
  if (url.startsWith(localPrefix)) {
    const file = path.resolve(publicRoot(), url.slice(localPrefix.length));
    if (!file.startsWith(publicRoot() + path.sep)) throw new Error("Image path is outside the public folder");
    const bytes = await fs.readFile(file);
    return { mimeType: MIME_BY_EXT[path.extname(file).toLowerCase()] ?? "image/jpeg", data: bytes.toString("base64") };
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_BYTES) throw new Error("Image too large");
  return { mimeType: res.headers.get("content-type")?.split(";")[0] || "image/jpeg", data: bytes.toString("base64") };
};

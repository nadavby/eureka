import sharp from "sharp";
import { badRequest } from "../lib/errors";

export const MAX_DIMENSION = 1600;
// Formats detected from the bytes themselves. SVG is excluded on purpose: it can carry scripts.
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif", "heif"]);
const UNSUPPORTED = "Unsupported image. Please upload a JPEG, PNG, WebP or GIF photo";

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
}

/**
 * Normalises an uploaded photo before it is stored or shown to anyone:
 * - the format is checked from the bytes, not from the file name or MIME type
 * - EXIF orientation is applied, then ALL metadata is dropped (phone photos carry GPS positions)
 * - the photo is fitted inside 1600x1600 and re-encoded as WebP
 */
export const processImage = async (input: Buffer): Promise<ProcessedImage> => {
  let format: string | undefined;
  try {
    format = (await sharp(input).metadata()).format;
  } catch {
    throw badRequest(UNSUPPORTED);
  }
  if (!format || !ACCEPTED_FORMATS.has(format)) throw badRequest(UNSUPPORTED);

  try {
    // sharp writes no metadata unless .keepMetadata()/.withMetadata() is called
    const { data, info } = await sharp(input, { failOn: "error", animated: false })
      .rotate()
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, width: info.width, height: info.height };
  } catch {
    throw badRequest("The image could not be read. It may be damaged");
  }
};

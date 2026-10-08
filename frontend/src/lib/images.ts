/**
 * Shrinks a photo in the browser before upload: faster on mobile data, and it turns
 * formats the server cannot decode (iPhone HEIC, when the browser can) into JPEG.
 * The server still re-encodes and strips metadata; this is only an optimisation.
 */
export const downscaleImage = async (file: File, maxSide = 2000, quality = 0.88): Promise<Blob> => {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // the browser can't decode it either; let the server decide
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", quality));
};

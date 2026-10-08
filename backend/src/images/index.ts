import { logger } from "../lib/logger";
import { processImage } from "./process-image";
import { ImageFolder, imageStorage, StoredImage } from "./storage";

/** Validates, cleans (EXIF/GPS stripped) and stores an uploaded photo. */
export const storeUpload = async (file: Express.Multer.File, folder: ImageFolder): Promise<StoredImage> => {
  const { buffer } = await processImage(file.buffer);
  return imageStorage.save(buffer, folder);
};

/** Best effort: a leftover file must never block deleting the record that used it. */
export const removeStoredImage = async (publicId: string | undefined) => {
  if (!publicId) return;
  try {
    await imageStorage.remove(publicId);
  } catch (err) {
    logger.warn({ err, publicId }, "Failed to delete stored image");
  }
};

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { config } from "../lib/config";

export type ImageFolder = "items" | "users";
const FOLDERS: ImageFolder[] = ["items", "users"];

export interface StoredImage {
  url: string;
  /** Handle used to delete the image later. */
  publicId: string;
}

export interface ImageStorage {
  save(webp: Buffer, folder: ImageFolder): Promise<StoredImage>;
  remove(publicId: string): Promise<void>;
}

/** Files under public/ served by Express at /public. For development and tests. */
export class LocalImageStorage implements ImageStorage {
  constructor(
    private readonly root = path.resolve("public"),
    private readonly baseUrl = `${config.DOMAIN_BASE}/public`
  ) {}

  private resolve(publicId: string) {
    const [folder] = publicId.split("/");
    const file = path.resolve(this.root, publicId);
    if (!FOLDERS.includes(folder as ImageFolder) || !file.startsWith(path.resolve(this.root, folder) + path.sep)) {
      throw new Error(`Invalid image id: ${publicId}`);
    }
    return file;
  }

  async save(webp: Buffer, folder: ImageFolder): Promise<StoredImage> {
    const publicId = `${folder}/${randomUUID()}.webp`;
    const file = this.resolve(publicId);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, webp);
    return { url: `${this.baseUrl}/${publicId}`, publicId };
  }

  async remove(publicId: string): Promise<void> {
    await fs.rm(this.resolve(publicId), { force: true });
  }
}

type Uploader = Pick<typeof cloudinary.uploader, "upload_stream" | "destroy">;

/** Cloudinary, configured from CLOUDINARY_URL (cloudinary://key:secret@cloud). */
export class CloudinaryImageStorage implements ImageStorage {
  constructor(private readonly uploader: Uploader = cloudinary.uploader) {}

  save(webp: Buffer, folder: ImageFolder): Promise<StoredImage> {
    return new Promise((resolve, reject) => {
      const stream = this.uploader.upload_stream(
        { folder: `eureka/${folder}`, resource_type: "image", format: "webp", overwrite: false },
        (err, result?: UploadApiResponse) => {
          if (err || !result) return reject(err ?? new Error("Empty Cloudinary response"));
          resolve({ url: result.secure_url, publicId: result.public_id });
        }
      );
      stream.end(webp);
    });
  }

  async remove(publicId: string): Promise<void> {
    await this.uploader.destroy(publicId, { invalidate: true });
  }
}

export const createImageStorage = (): ImageStorage => {
  if (config.IMAGE_STORAGE === "cloudinary") {
    // The SDK reads CLOUDINARY_URL from the environment; secure URLs only.
    cloudinary.config({ secure: true });
    return new CloudinaryImageStorage();
  }
  return new LocalImageStorage();
};

export const imageStorage = createImageStorage();

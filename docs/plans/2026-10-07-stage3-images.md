# Stage 3: Image Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Images survive deploys (Render's free tier has no persistent disk), never leak the uploader's location, and are served at the right size.

**Architecture:**
- Upload: multer keeps the file in memory. `processImage` checks the real format from the bytes and re-encodes it to a clean WebP. An `ImageStorage` (Cloudinary in production, local disk in dev/test) stores it.
- The DB stores `imageUrl` plus `imagePublicId`, so deletes also clean up storage.

**Tech Stack:** sharp, cloudinary v2, multer memoryStorage.

Spec §3, plus one addition decided while planning:

- **Strip EXIF/GPS on the server.** Phone photos embed the GPS position where they were taken. Re-encoding with sharp drops all metadata after applying the EXIF orientation. The browser-side downscale (stage 4) is an optimisation and not something security relies on.

## Files

| File | Responsibility |
|---|---|
| `src/images/process-image.ts` | `processImage(buffer)`: detect the format from the bytes (jpeg/png/webp/gif/avif/heif-if-supported), reject anything else, auto-rotate, fit inside 1600×1600 (no upscaling), WebP q82, no metadata. Returns `{ buffer, width, height }` |
| `src/images/storage.ts` | `ImageStorage` interface: `save(buffer, folder) → { url, publicId }`, `remove(publicId)`. `LocalImageStorage` (public/<folder>, served at /public) and `CloudinaryImageStorage`; `createImageStorage()` picks one from config |
| `src/middleware/upload.ts` | multer memoryStorage, 8 MB raw limit (re-encoding shrinks it), MIME pre-check kept as a fast path |
| `src/controllers/item_controller.ts`, `routes/file_routes.ts` | process, then save; store `imagePublicId`; delete the image when the item is deleted (best effort, logged) |
| `src/models/item_model.ts` | `imagePublicId` (not serialized) |
| `src/lib/config.ts` | `CLOUDINARY_URL`, `IMAGE_STORAGE` (`local`/`cloudinary`, default `cloudinary` when `CLOUDINARY_URL` is set) |

## Tasks

1. **processImage (TDD).** Fixtures are generated in the test with sharp: a JPEG with EXIF GPS and orientation 6, a 4000×3000 PNG, a text file and a truncated JPEG. Tests:
   - The output is WebP.
   - There is no EXIF/GPS (`sharp(out).metadata().exif` is undefined).
   - Orientation is applied: portrait dimensions after rotate.
   - It fits in 1600 and small images aren't upscaled.
   - Non-images and corrupt data throw `badRequest`.
2. **Storage (TDD).**
   - `LocalImageStorage`: writes `<folder>/<uuid>.webp`, returns the public URL, `remove` deletes the file and ignores a missing one, and folder names are whitelisted.
   - `CloudinaryImageStorage` with an injected fake uploader: calls `upload_stream` with `{ folder: "eureka/<folder>", resource_type: "image", format: "webp" }`, returns `secure_url`/`public_id`, and `remove` calls `destroy`.
3. **Wire upload + delete.**
   - The items and avatar routes use memory upload, then processImage, then storage.
   - The item stores `imagePublicId`, and deleting the item removes the image.
   - Tests: the uploaded file on disk is WebP without EXIF, a deleted item's file is gone, a GPS-tagged JPEG upload comes back clean, and the oversize limit is 8 MB.
4. **Config, docs, PR.**
   - `.env.example` (`CLOUDINARY_URL`), README (privacy note under Security), CI unchanged (local storage in tests).
   - Boot smoke test.
   - PR stacked on #3.

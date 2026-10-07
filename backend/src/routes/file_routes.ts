import express, { Request, Response } from "express";
import { asyncHandler } from "../lib/async-handler";
import { badRequest } from "../lib/errors";
import { storeUpload } from "../images";
import { uploadLimiter } from "../middleware/security";
import { imageUpload } from "../middleware/upload";

const router = express.Router();

/**
 * @swagger
 * /file:
 *   post:
 *     summary: Upload a profile picture
 *     description: Used during registration, before the user has an account, so no authentication is required. The image is re-encoded to WebP and all metadata (EXIF, GPS) is removed.
 *     tags: [Files]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: The public URL of the stored image
 *       400:
 *         description: Missing file, or not a supported image
 *       413:
 *         description: File larger than 8 MB
 */
router.post(
  "/",
  uploadLimiter,
  imageUpload().single("file"),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw badRequest("Missing file");
    const image = await storeUpload(req.file, "users");
    res.status(200).json({ url: image.url });
  })
);

export default router;

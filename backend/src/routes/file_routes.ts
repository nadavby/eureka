import express, { Request, Response } from "express";
import { config } from "../lib/config";
import { badRequest } from "../lib/errors";
import { uploadLimiter } from "../middleware/security";
import { imageUpload } from "../middleware/upload";

const router = express.Router();

/**
 * @swagger
 * /file:
 *   post:
 *     summary: Upload a profile picture
 *     description: Used during registration, before the user has an account, so no authentication is required. Images only, up to 5 MB.
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
 *         description: The public URL of the uploaded image
 *       400:
 *         description: Missing file or not an image
 *       413:
 *         description: File larger than 5 MB
 */
router.post("/", uploadLimiter, imageUpload("users").single("file"), (req: Request, res: Response) => {
  if (!req.file) throw badRequest("Missing file");
  res.status(200).json({ url: `${config.DOMAIN_BASE}/public/users/${req.file.filename}` });
});

export default router;

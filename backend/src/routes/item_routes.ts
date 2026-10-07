/** @format */

import express, { RequestHandler } from "express";
import {
  uploadItem,
  getAllItems,
  getItemById,
  deleteItem,
} from "../controllers/item_controller";
import { asyncHandler } from "../lib/async-handler";
import { requireAuth } from "../middleware/auth";
import { uploadLimiter } from "../middleware/security";
import { imageUpload } from "../middleware/upload";
import { validate } from "../middleware/validate";
import { idParams } from "../schemas/common";
import { createItemBody, listItemsQuery } from "../schemas/item.schema";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Items
 *   description: Lost and found items API
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Item:
 *       type: object
 *       required:
 *         - userId
 *         - imageUrl
 *         - itemType
 *       properties:
 *         _id:
 *           type: string
 *           description: The auto-generated ID of the item
 *         userId:
 *           type: string
 *           description: The ID of the user who uploaded the item
 *         imageUrl:
 *           type: string
 *           description: URL of the item image
 *         itemType:
 *           type: string
 *           enum: [lost, found]
 *           description: Whether the item is lost or found
 *         description:
 *           type: string
 *           description: Optional description of the item
 *         location:
 *           type: string
 *           description: Optional location where the item was lost/found
 *         category:
 *           type: string
 *           description: Optional category of the item
 *         visionApiData:
 *           type: object
 *           description: Data from Google Cloud Vision API analysis
 *         matchedItemId:
 *           type: string
 *           description: ID of a matching item if found
 *         isResolved:
 *           type: boolean
 *           description: Whether the lost/found case is resolved
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the item was uploaded
 *       example:
 *         _id: 60d21b4667d0d8992e610c85
 *         userId: 60d0fe4f5311236168a109ca
 *         imageUrl: http://example.com/public/items/1624365062087.jpg
 *         itemType: lost
 *         description: Red wallet with ID cards
 *         location: Central Park
 *         category: Wallet
 *         isResolved: false
 *         createdAt: 2023-01-01T19:00:00.000Z
 */


/**
 * @swagger
 * /items:
 *   post:
 *     summary: Add a new lost or found item
 *     description: Alternative endpoint to upload-item, with the same functionality
 *     tags: [Items]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - itemType
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Image of the item
 *               itemType:
 *                 type: string
 *                 enum: [lost, found]
 *                 description: Whether the item is lost or found
 *               description:
 *                 type: string
 *                 description: Description of the item
 *               location:
 *                 type: string
 *                 description: Location where the item was lost/found
 *               category:
 *                 type: string
 *                 description: Category of the item
 *     responses:
 *       201:
 *         description: Item uploaded successfully with potential matches
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 item:
 *                   $ref: '#/components/schemas/Item'
 *                 potentialMatches:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       item:
 *                         $ref: '#/components/schemas/Item'
 *                       score:
 *                         type: number
 *                         description: Similarity score (0-100)
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
const upload = imageUpload("items").fields([
  { name: "file", maxCount: 1 },
  { name: "image", maxCount: 1 },
]);

// legacy clients send `kind` instead of `itemType` and `name` instead of `description`
const acceptLegacyFields: RequestHandler = (req, _res, next) => {
  if (!req.body.itemType && req.body.kind) req.body.itemType = req.body.kind;
  if (!req.body.description && req.body.name) req.body.description = req.body.name;
  next();
};

router.post(
  "/",
  requireAuth,
  uploadLimiter,
  ...upload,
  acceptLegacyFields,
  validate({ body: createItemBody }),
  asyncHandler(uploadItem)
);

/**
 * @swagger
 * /items:
 *   get:
 *     summary: Get all items
 *     description: Retrieve a list of all lost and found items with optional filtering
 *     tags: [Items]
 *     parameters:
 *       - in: query
 *         name: itemType
 *         schema:
 *           type: string
 *           enum: [lost, found]
 *         description: Filter by item type
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *     responses:
 *       200:
 *         description: A list of items
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Item'
 *       500:
 *         description: Server error
 */
router.get("/", validate({ query: listItemsQuery }), asyncHandler(getAllItems));

/**
 * @swagger
 * /items/{id}:
 *   get:
 *     summary: Get item by ID
 *     description: Retrieve details of a specific item by its ID
 *     tags: [Items]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Item ID
 *     responses:
 *       200:
 *         description: Item details including any matched item
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 item:
 *                   $ref: '#/components/schemas/Item'
 *                 matchedItem:
 *                   $ref: '#/components/schemas/Item'
 *       404:
 *         description: Item not found
 *       500:
 *         description: Server error
 */
router.get("/:id", validate({ params: idParams }), asyncHandler(getItemById));

/**
 * @swagger
 * /items/{id}:
 *   delete:
 *     summary: Delete an item
 *     description: Delete a lost or found item
 *     tags: [Items]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Item ID
 *     responses:
 *       200:
 *         description: Item deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not the item owner
 *       404:
 *         description: Item not found
 *       500:
 *         description: Server error
 */
router.delete("/:id", requireAuth, validate({ params: idParams }), asyncHandler(deleteItem));

export = router;

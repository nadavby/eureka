import express from "express";
import matchController from "../controllers/match_controller";
import { asyncHandler } from "../lib/async-handler";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { idParams } from "../schemas/common";
import { confirmMatchBody, userIdParams } from "../schemas/match.schema";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Matches
 *   description: AI-suggested matches between a lost item and a found item
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Match:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         item1Id:
 *           type: string
 *           description: The item that was already in the system
 *         userId1:
 *           type: string
 *         item2Id:
 *           type: string
 *           description: The newly uploaded item that triggered the match
 *         userId2:
 *           type: string
 *         matchScore:
 *           type: number
 *           description: Confidence score 0-100
 *         user1Confirmed:
 *           type: boolean
 *         user2Confirmed:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /match/user/{userId}:
 *   get:
 *     summary: List my matches
 *     description: Returns every match the authenticated user takes part in. `userId` must be the caller's own id.
 *     tags: [Matches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The user's matches
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Match'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: userId is not the caller
 */
router.get("/user/:userId", requireAuth, validate({ params: userIdParams }), asyncHandler(matchController.getAllByUserId));

/**
 * @swagger
 * /match/confirm:
 *   post:
 *     summary: Confirm a match
 *     description: Records the caller's confirmation. When both users have confirmed, both items are marked resolved and all related matches, chats and notifications are removed.
 *     tags: [Matches]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [matchId]
 *             properties:
 *               matchId:
 *                 type: string
 *     responses:
 *       200:
 *         description: PARTIALLY_CONFIRMED or FULLY_CONFIRMED
 *       400:
 *         description: Invalid body, or already confirmed by the caller
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: The caller is not part of the match
 *       404:
 *         description: Match not found
 */
router.post("/confirm", requireAuth, validate({ body: confirmMatchBody }), asyncHandler(matchController.confirmMatch));

/**
 * @swagger
 * /match/{id}:
 *   get:
 *     summary: Get a match
 *     tags: [Matches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The match
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Match'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: The caller is not part of the match
 *       404:
 *         description: Match not found
 *   delete:
 *     summary: Reject (delete) a match
 *     description: Deletes the match together with its chat and notifications.
 *     tags: [Matches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: The caller is not part of the match
 *       404:
 *         description: Match not found
 */
router.get("/:id", requireAuth, validate({ params: idParams }), asyncHandler(matchController.getById));
router.delete("/:id", requireAuth, validate({ params: idParams }), asyncHandler(matchController.deleteById));

export default router;

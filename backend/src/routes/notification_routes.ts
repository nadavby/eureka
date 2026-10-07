import { Router } from "express";
import notificationController from "../controllers/notification_controller";
import { asyncHandler } from "../lib/async-handler";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { idParams } from "../schemas/common";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Notifications of the authenticated user (always scoped to the caller)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         userId:
 *           type: string
 *         matchId:
 *           type: string
 *         type:
 *           type: string
 *           example: MATCH_FOUND
 *         title:
 *           type: string
 *         message:
 *           type: string
 *         isRead:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /notification:
 *   get:
 *     summary: List my notifications (newest first)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "{ data: Notification[] }"
 *       401:
 *         description: Not authenticated
 */
router.get("/", requireAuth, asyncHandler(notificationController.getAllByUserId));

/**
 * @swagger
 * /notification/read-all:
 *   put:
 *     summary: Mark all my notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "{ message, modifiedCount }"
 *       401:
 *         description: Not authenticated
 */
router.put("/read-all", requireAuth, asyncHandler(notificationController.markAllAsRead));

/**
 * @swagger
 * /notification/{id}:
 *   get:
 *     summary: Get one of my notifications
 *     tags: [Notifications]
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
 *         description: "{ data: Notification }"
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Not found (or not mine)
 *   delete:
 *     summary: Delete one of my notifications
 *     tags: [Notifications]
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
 *       404:
 *         description: Not found (or not mine)
 */
router.get("/:id", requireAuth, validate({ params: idParams }), asyncHandler(notificationController.getById));
router.delete("/:id", requireAuth, validate({ params: idParams }), asyncHandler(notificationController.deleteById));

/**
 * @swagger
 * /notification/{id}/read:
 *   put:
 *     summary: Mark one of my notifications as read
 *     tags: [Notifications]
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
 *         description: "{ data: Notification }"
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Not found (or not mine)
 */
router.put("/:id/read", requireAuth, validate({ params: idParams }), asyncHandler(notificationController.markAsRead));

export default router;

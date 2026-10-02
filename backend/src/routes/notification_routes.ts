import { Router } from "express";
import { authMiddleware } from "../controllers/auth_controller";
import notificationController from "../controllers/notification_controller";

const router = Router();

router.get("/", authMiddleware, notificationController.getAllByUserId);

router.get("/:id", authMiddleware, notificationController.getById);

router.delete("/:id", authMiddleware, notificationController.deleteById);

router.put("/:id/read", authMiddleware, notificationController.markAsRead);

router.put("/read-all", authMiddleware, notificationController.markAllAsRead);

export = router;
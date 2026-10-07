import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import notificationController from "../controllers/notification_controller";

const router = Router();

router.get("/", requireAuth, notificationController.getAllByUserId);

router.get("/:id", requireAuth, notificationController.getById);

router.delete("/:id", requireAuth, notificationController.deleteById);

router.put("/:id/read", requireAuth, notificationController.markAsRead);

router.put("/read-all", requireAuth, notificationController.markAllAsRead);

export = router;
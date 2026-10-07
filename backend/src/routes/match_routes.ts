import express from 'express';
import matchController from '../controllers/match_controller';
import { requireAuth } from "../middleware/auth";

const router = express.Router();

router.get('/user/:userId', requireAuth, matchController.getAllByUserId);
router.get('/:id', requireAuth, matchController.getById);
router.delete('/:id', requireAuth, matchController.deleteById);
router.post('/confirm', requireAuth, matchController.confirmMatch);

export default router; 
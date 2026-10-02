import express from 'express';
import matchController from '../controllers/match_controller';
import { authMiddleware } from '../controllers/auth_controller';

const router = express.Router();

router.get('/user/:userId', authMiddleware, matchController.getAllByUserId);
router.get('/:id', authMiddleware, matchController.getById);
router.delete('/:id', authMiddleware, matchController.deleteById);
router.post('/confirm', authMiddleware, matchController.confirmMatch);

export default router; 
/** @format */
import { Request, Response } from "express";
import matchModel from "../models/match_model";
import notificationModel from "../models/notification_model";
import itemModel from "../models/item_model";
import chatModel from "../models/chat_model";

const getAllByUserId = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const matches = await matchModel.find({
      $or: [{ userId1: userId }, { userId2: userId }],
    });
    res.json(matches);
  } catch (error) {
    console.error('Error getting matches:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getById = async (req: Request, res: Response) => {
  try {
    const match = await matchModel.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }
    res.json(match);
  } catch (error) {
    console.error('Error getting match:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const deleteById = async (req: Request, res: Response) => {
  try {
    const match = await matchModel.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    // Delete all notifications associated with this match
    await notificationModel.deleteMany({ matchId: match._id });

    // Delete the match
    await matchModel.findByIdAndDelete(req.params.id);
    res.json({ message: 'Match and associated notifications deleted successfully' });
  } catch (error) {
    console.error('Error deleting match:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// make sure to delete all matches related to both items
const confirmMatch = async (req: Request, res: Response) => {
  try {
    const { matchId, userId } = req.body;

    if (!matchId || !userId) {
      return res.status(400).json({ message: 'Missing required fields: matchId and userId' });
    }
    await notificationModel.deleteMany({
      matchId: matchId,
    });

    const match = await matchModel.findById(matchId);

    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    // Verify this user is part of the match
    if (match.userId1 !== userId && match.userId2 !== userId) {
      return res.status(403).json({ message: 'User is not part of this match' });
    }

    // Determine which user is confirming
    const isUser1 = match.userId1 === userId;
    const updateField = isUser1 ? 'user1Confirmed' : 'user2Confirmed';

    // Check if this user has already confirmed
    if (isUser1 ? match.user1Confirmed : match.user2Confirmed) {
      return res.status(400).json({ message: 'You have already confirmed this match' });
    }

    // Update match confirmation status
    const updatedMatch = await matchModel.findByIdAndUpdate(
      matchId,
      { $set: { [updateField]: true } },
      { new: true }
    );

    if (!updatedMatch) {
      return res.status(404).json({ message: 'Match not found after update' });
    }

    // If both users have confirmed, perform cleanup
    if (updatedMatch.user1Confirmed && updatedMatch.user2Confirmed) {
      // Mark both items as resolved
      await Promise.all([
        itemModel.findByIdAndUpdate(match.item1Id, { isResolved: true }),
        itemModel.findByIdAndUpdate(match.item2Id, { isResolved: true })
      ]);

      // Delete all notifications for this match
      await notificationModel.deleteMany({ matchId });
      
      // Delete all chat messages for this match
      await chatModel.deleteMany({ matchId });

      // Delete the match since it's fully confirmed
      await matchModel.findByIdAndDelete(matchId);

      // Delete all matches related to both items (maybe item1Id is Item2id in the match) 
      await matchModel.deleteMany({ $or: [{ item1Id: match.item1Id}, {item2Id: match.item2Id }, { item1Id: match.item2Id}, {item2Id: match.item1Id }]   });

      // Delete all notifications related to both items
      await notificationModel.deleteMany({ $or: [{ item1Id: match.item1Id}, {item2Id: match.item2Id }, { item1Id: match.item2Id}, {item2Id: match.item1Id }] });
      
      return res.json({ 
        message: 'Match fully confirmed and completed',
        status: 'FULLY_CONFIRMED',
        match: updatedMatch 
      });
    }

    // Return appropriate message based on confirmation status
    res.json({
      message: 'Match confirmation updated',
      status: 'PARTIALLY_CONFIRMED',
      match: updatedMatch,
      userConfirmed: isUser1 ? 'user1' : 'user2',
      awaitingConfirmation: isUser1 ? 'user2' : 'user1'
    });

  } catch (error) {
    console.error('Error confirming match:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export default {
  getAllByUserId,
  deleteById,
  getById,
  confirmMatch,
};


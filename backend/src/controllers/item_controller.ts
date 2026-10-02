/** @format */
import { Request, Response } from "express";
import itemModel, { IItem } from "../models/item_model";
import userModel from "../models/user_model";
import { emitNotification } from "../services/notification.socket.service";
import { MatchingService } from "../services/matching-service";
import visionService from "../services/vision-service";
import matchModel, { IMatch } from "../models/match_model";
import notificationModel, { INotification } from "../models/notification_model";

const findPotentialMatches = async (
  item: IItem
): Promise<Array<{ item: IItem; score: number }>> => {
  try {
    const oppositeType = item.itemType === "lost" ? "found" : "lost";
    const potentialMatches = await itemModel.find({
      itemType: oppositeType,
      isResolved: false,
    });

    const matches = await MatchingService(item, potentialMatches);
    const significantMatches = matches.map((match) => ({
      item: match.item,
      score: match.confidenceScore,
    }));
    return significantMatches;
  } catch (error) {
    console.error("Error finding potential matches:", error);
    return [];
  }
};

const uploadItem = async (req: Request, res: Response) => {
  try {
    console.log("Uploading New Item");

    if (!req.body.userId) {
      console.error("Missing userId in request body");
      return res.status(400).send("Error");
    }

    if (!req.body.imageUrl) {
      console.error("Missing imageUrl in request body");
      return res.status(400).send();
    }

    if (typeof req.body.imageUrl !== "string" || !req.body.imageUrl.trim()) {
      console.error("Invalid imageUrl format:", req.body.imageUrl);
      return res.status(400).send("Error");
    }

    if (!req.body.itemType) {
      console.error("Missing itemType in request body");
      return res.status(400).send("Error");
    }

    if (req.body.itemType !== "lost" && req.body.itemType !== "found") {
      console.error("Invalid itemType:", req.body.itemType);
      return res.status(400).send("Error");
    }

    const visionApiData = await enhanceItemWithAI(req.body.imageUrl);

    const user = await userModel.findById(req.body.userId);
    if (!user) {
      console.error("User not found:", req.body.userId);
      return res.status(400).send("Error");
    }

    let locationData = req.body.location;
    if (typeof locationData === "string") {
      try {
        locationData = JSON.parse(locationData);
        console.log("Successfully parsed location JSON:", locationData);
      } catch (e) {
        console.error("Failed to parse location JSON:", e);
      }
    }

    const newItem: IItem = {
      userId: req.body.userId,
      imageUrl: req.body.imageUrl,
      itemType: req.body.itemType,
      description: req.body.description,
      location: locationData,
      date: req.body.date,
      category: req.body.category,
      colors: req.body.colors,
      brand: req.body.brand || "",
      condition: req.body.condition,
      flaws: req.body.flaws,
      material: req.body.material,
      ownerName: user.userName,
      ownerEmail: user.email,
      visionApiData: visionApiData.visionApiData,
      isResolved: false,
    };

    const savedItem = await itemModel.create(newItem);

    let potentialMatches: Array<{ item: IItem; score: number }> = [];
    try {
      potentialMatches = await findPotentialMatches(savedItem);
    } catch (error) {
      console.error("Error finding potential matches:", error);
      potentialMatches = [];
    }

    try {
      const highConfidenceMatches = potentialMatches.filter(
        (match) => match.score > 70
      );

      if (highConfidenceMatches.length > 0) {
        console.log(
          `Found ${highConfidenceMatches.length} high-confidence matches, sending notifications`
        );

        for (const match of highConfidenceMatches) {
          const matchedItem = match.item;
          const matchOwner = await userModel.findById(matchedItem.userId);

          if (matchOwner && matchedItem._id) {
            const newMatch: IMatch = {
              item1Id: matchedItem._id,
              userId1: matchOwner._id,
              item2Id: savedItem._id,
              userId2: savedItem.userId,
              matchScore: match.score,
              user1Confirmed: false,
              user2Confirmed: false
            };
            const savedMatch = await matchModel.create(newMatch);
            if (!savedMatch) {
              res.status(400).send("Error");
              return;
            }
            const newNotification: INotification = {
              type: "MATCH_FOUND",
              title: "Potential Match Found!",
              message: `We found a potential match for your ${matchedItem.itemType} item!`,
              userId: matchedItem.userId,
              matchId: savedMatch._id,
              isRead: false,
            };
            const savedNotification =
              await notificationModel.create(newNotification);
            if (!savedNotification) {
              res.status(400).send("Error");
              return;
            }
            emitNotification(savedNotification.userId, savedNotification);
            const newNotification2: INotification = {
              type: "MATCH_FOUND",
              title: "Potential Match Found!",
              message: `We found a potential match for your ${savedItem.itemType} item!`,
              userId: savedItem.userId,
              matchId: savedMatch._id,
              isRead: false,
            };
            const savedNotification2 =
              await notificationModel.create(newNotification2);
            if (!savedNotification2) {
              res.status(400).send("Error");
              return;
            }
            emitNotification(savedNotification2.userId, savedNotification2);

            console.log(
              `Sent notification to user ${matchedItem.userId} (${matchOwner.email})`
            );
          }
        }
      }
    } catch (error) {
      console.error("Error notifying matched item owner:", error);
    }

    return res.status(201).send(newItem);
  } catch (error) {
    console.error("Error uploading item:", error);
     res.status(500).send("Error fetching item: " + (error as Error).message);
    return;
  }
};

const getAllItems = async (req: Request, res: Response) => {
  try {
    const itemType = req.query.itemType;
    const userId = req.query.userId;

    const query: Record<string, unknown> = {};

    if (itemType && (itemType === "lost" || itemType === "found")) {
      query.itemType = itemType;
    }

    if (userId) {
      query.userId = userId;
    }

    const items = await itemModel.find(query);

    return res.status(200).send(items);
  } catch (error) {
    console.error("Error getting items:", error);
    return res
      .status(500)
      .send("Error fetching items: " + (error as Error).message);
  }
};

const getItemById = async (req: Request, res: Response) => {
  try {
    const itemId = req.params.id;
    const item = await itemModel.findById(itemId);

    if (!item) {
      return res.status(404).send("Item not found");
    }
    return res.status(200).send(item);
  } catch (error) {
    console.error("Error getting item by ID:", error);
    return res
      .status(500)
      .send("Error fetching item: " + (error as Error).message);
  }
};

const deleteItem = async (req: Request, res: Response) => {
  try {
    const item = await itemModel.findById(req.params.id);
    if (!item) {
      res.status(404).send("Item not found");
      return;
    }
 
    const matches = await matchModel.find({
      $or: [{ item1Id: req.params.id }, { item2Id: req.params.id }],
    });
    if (matches.length > 0) {
      for (const match of matches) {
        await notificationModel.deleteMany({
          matchId: match._id,
        });
        await matchModel.findByIdAndDelete(match._id);
      }
    }

    await itemModel.findByIdAndDelete(req.params.id);
    res.status(200).send("Item deleted successfully");
  } catch (error) {
    res.status(500).send("Error deleting item: " + (error as Error).message);
  }
};

const enhanceItemWithAI = async (imageUrl: string) => {
  try {
    const visionAnalysisResult = await visionService.getImageAnalysis(imageUrl);
    const labels = visionAnalysisResult.labels;
    const objects = visionAnalysisResult.objects.map((obj) => ({
      name: obj.name,
      score: obj.score,
      boundingBox: obj.boundingBox || {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      },
    })
  );
  const texts = visionAnalysisResult.texts;
  const logos = visionAnalysisResult.logos;
    return {
      visionApiData: {
        labels,
        objects,
        texts,
        logos,
      },
    };
  } catch (error) {
    console.error("Error enhancing item with AI:", error);
    return {
      visionApiData: {
        labels: [],
        objects: [],
      },
    };
  }
};

export { uploadItem, getAllItems, getItemById, deleteItem};


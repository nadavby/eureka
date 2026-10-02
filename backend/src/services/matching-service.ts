import { IItem } from '../models/item_model';
import { AIMatchingService } from './ai-matching-service';

const calculateDistanceInKm = (
  location1: { lat: number; lng: number } | string | undefined,
  location2: { lat: number; lng: number } | string | undefined
): number => {
  if (!location1 || !location2 || typeof location1 === 'string' || typeof location2 === 'string') {
    return Infinity; 
  }

  const R = 6371; 
  const dLat = ((location2.lat - location1.lat) * Math.PI) / 180;
  const dLon = ((location2.lng - location1.lng) * Math.PI) / 180;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((location1.lat * Math.PI) / 180) *
    Math.cos((location2.lat * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};


export const shouldSkipComparison = (lostItem: IItem, foundItem: IItem): boolean => {
  if (lostItem.isResolved || foundItem.isResolved) return true;

  if (lostItem.date && foundItem.date && 
      new Date(foundItem.date) < new Date(lostItem.date)) {
    return true;
  }

  if (lostItem.category && foundItem.category && 
      lostItem.category !== foundItem.category) {
    return true;
  }

  const distance = calculateDistanceInKm(lostItem.location, foundItem.location);
  if (distance < Infinity && distance > 8) {
    return true;
  }

  return false;
};


 export const MatchingService =
  async(
    targetItem: IItem,
    potentialMatches: IItem[]
  ): Promise<{ item: IItem; confidenceScore: number }[]> => {
    try {
      return await AIMatchingService(targetItem, potentialMatches);
    } catch (error) {
     console.log(error);
     return [];
    }
  }


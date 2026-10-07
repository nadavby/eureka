/** Shapes returned by the Eureka API. */

export interface User {
  _id: string;
  userName: string;
  imgURL?: string | null;
  /** Only present for yourself and for users you share a match with. */
  email?: string;
  phoneNumber?: string;
}

export type ItemType = "lost" | "found";
export type MatchingStatus = "analyzing" | "searching" | "done" | "failed";

export interface ItemAttributes {
  category: string;
  subcategory: string;
  brand: string;
  model: string;
  colors: string[];
  material: string;
  distinctiveFeatures: string[];
  visibleText: string[];
  description: string;
}

export interface Item {
  _id: string;
  userId: string;
  itemType: ItemType;
  imageUrl: string;
  category: string;
  description?: string;
  date: string;
  location: { lat: number; lng: number };
  placeName?: string;
  colors: string[];
  brand?: string;
  material?: string;
  condition?: "new" | "worn" | "damaged" | "other";
  flaws?: string;
  attributes?: ItemAttributes;
  matchingStatus: MatchingStatus;
  matchingError?: string;
  matchCount: number;
  isResolved: boolean;
  createdAt: string;
}

export interface Match {
  _id: string;
  item1Id: string;
  userId1: string;
  item2Id: string;
  userId2: string;
  matchScore: number;
  verdict?: "match" | "possible" | "no_match";
  reasons: string[];
  conflicts: string[];
  user1Confirmed: boolean;
  user2Confirmed: boolean;
  /** Set when both owners confirmed. */
  confirmedAt?: string;
  createdAt: string;
}

export interface AppNotification {
  _id: string;
  userId: string;
  matchId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface ChatMessage {
  _id: string;
  matchId: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  status: "sent" | "delivered" | "read";
}

export interface ItemStatusEvent {
  itemId: string;
  status: MatchingStatus;
  matchCount: number;
}

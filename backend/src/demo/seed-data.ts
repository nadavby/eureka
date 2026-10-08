/**
 * The demo world: four residents of Tel Aviv and the things they lost or found.
 * Illustrations live in demo/images (drawn for Eureka; no third-party images).
 * Descriptions carry the identifying details the matcher looks for.
 */
export interface SeedBot {
  key: string;
  userName: string;
  phoneNumber: string;
}

export interface SeedItem {
  owner: string;
  itemType: "lost" | "found";
  image: string;
  category: string;
  colors: string[];
  brand?: string;
  description: string;
  placeName: string;
  location: { lat: number; lng: number };
  daysAgo: number;
}

export const BOTS: SeedBot[] = [
  { key: "noam", userName: "Noam", phoneNumber: "+972-50-000-0101" },
  { key: "shira", userName: "Shira", phoneNumber: "+972-50-000-0102" },
  { key: "avi", userName: "Avi", phoneNumber: "+972-50-000-0103" },
  { key: "lena", userName: "Lena", phoneNumber: "+972-50-000-0104" },
];

export const ITEMS: SeedItem[] = [
  {
    owner: "shira", itemType: "lost", image: "keys.svg", category: "keys", colors: ["silver", "red"],
    description: "Two keys, one silver and one brass, on a red carabiner with a small blue star tag",
    placeName: "Dizengoff Center, Tel Aviv", location: { lat: 32.0753, lng: 34.7754 }, daysAgo: 1,
  },
  {
    owner: "avi", itemType: "found", image: "phone.svg", category: "phone", colors: ["black"],
    description: "Black phone with a cracked top-right corner and a yellow smiley sticker on the case",
    placeName: "Sarona Market, Tel Aviv", location: { lat: 32.0712, lng: 34.787 }, daysAgo: 2,
  },
  {
    owner: "lena", itemType: "lost", image: "backpack.svg", category: "bag", colors: ["navy"],
    description: "Navy backpack with an orange zipper pull and a white patch with a mountain logo",
    placeName: "Tel Aviv University", location: { lat: 32.1133, lng: 34.8044 }, daysAgo: 3,
  },
  {
    owner: "noam", itemType: "found", image: "glasses.svg", category: "glasses", colors: ["brown"],
    description: "Tortoiseshell sunglasses, the left lens is scratched",
    placeName: "Gordon Beach, Tel Aviv", location: { lat: 32.0838, lng: 34.7676 }, daysAgo: 1,
  },
  {
    owner: "shira", itemType: "found", image: "headphones.svg", category: "headphones", colors: ["white", "purple"],
    description: "White over-ear headphones with a purple check sticker on the right ear cup",
    placeName: "Savidor Center station, Tel Aviv", location: { lat: 32.0839, lng: 34.7985 }, daysAgo: 4,
  },
  {
    owner: "avi", itemType: "lost", image: "umbrella.svg", category: "umbrella", colors: ["green", "brown"],
    description: "Green folding umbrella with a wooden J handle and a white strap",
    placeName: "Arlozorov bus terminal, Tel Aviv", location: { lat: 32.0852, lng: 34.7987 }, daysAgo: 5,
  },
  {
    owner: "lena", itemType: "found", image: "watch.svg", category: "watch", colors: ["gold", "green", "brown"],
    description: "Gold watch with a green dial and a brown leather strap, engraved M & R on the back",
    placeName: "Yarkon Park, Tel Aviv", location: { lat: 32.0985, lng: 34.8095 }, daysAgo: 2,
  },
  {
    owner: "noam", itemType: "lost", image: "dog.svg", category: "pet", colors: ["beige", "brown"],
    description: "Small beige dog named Pita, one brown ear, red collar with a bone-shaped tag. Friendly.",
    placeName: "Meir Garden, Tel Aviv", location: { lat: 32.0727, lng: 34.7745 }, daysAgo: 0,
  },
  {
    owner: "avi", itemType: "found", image: "bicycle.svg", category: "bicycle", colors: ["blue"],
    description: "Light blue city bike with a wicker basket and a bell, the rear fender is dented",
    placeName: "Allenby St, Tel Aviv", location: { lat: 32.0655, lng: 34.7715 }, daysAgo: 6,
  },
];

/** The starter scenario every visitor gets: their lost wallet and Noam's matching find. */
export const SCENARIO = {
  bot: "noam",
  score: 92,
  reasons: [
    "Same torn corner at the bottom right of the wallet",
    "The initials N.B. are embossed in the same place on the front",
    "Same brown leather with the same dashed stitching",
  ],
  conflicts: ["The finder's photo was taken outdoors, so the color looks a little lighter"],
  firstMessage: "Hi! I think I found your wallet on a bench near Habima Square. Can you tell me something that's inside, so I know it's yours?",
  botReply:
    "Yes, there's a receipt from the bookshop on Ibn Gabirol! It's yours. Confirm the match and you'll see my number, so we can meet at Habima.",
  lost: {
    image: "wallet-lost.svg",
    category: "wallet",
    colors: ["brown"],
    description: "Brown leather bifold wallet, torn bottom corner, initials N.B. embossed on the front",
    placeName: "Rothschild Blvd, Tel Aviv",
    location: { lat: 32.0636, lng: 34.7741 },
    daysAgo: 1,
  },
  found: {
    image: "wallet-found.svg",
    category: "wallet",
    colors: ["brown"],
    description: "Brown leather wallet found on a bench, one corner is torn, initials N.B. on the front",
    placeName: "Habima Square, Tel Aviv",
    location: { lat: 32.0727, lng: 34.779 },
    daysAgo: 0,
  },
};

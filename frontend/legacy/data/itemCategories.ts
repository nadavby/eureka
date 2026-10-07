export interface ItemCategory {
  label: string;
  value: string;
}

export interface ItemCategoryGroup {
  label: string;
  options: ItemCategory[];
}

export const itemCategories: ItemCategoryGroup[] = [
  {
    label: "Personal Items",
    options: [
      { label: "Keys / Keychain", value: "keys" },
      { label: "Wallet", value: "wallet" },
      { label: "ID Card / Driver's License / Passport", value: "id_card" },
      { label: "Credit Card / Prepaid Card", value: "credit_card" },
      { label: "Cash / Banknotes", value: "cash" },
      { label: "Sunglasses", value: "sunglasses" },
      { label: "Eyeglasses", value: "eyeglasses" },
      { label: "Watch (Wrist / Smart)", value: "watch" },
      { label: "Jewelry (Ring, Necklace, Bracelet, etc.)", value: "jewelry" },
      { label: "Scarf / Hat / Gloves", value: "winter_accessories" },
      { label: "Umbrella", value: "umbrella" },
      { label: "Belt", value: "belt" }
    ]
  },
  {
    label: "Electronics",
    options: [
      { label: "Mobile Phone", value: "mobile_phone" },
      { label: "Laptop", value: "laptop" },
      { label: "Tablet", value: "tablet" },
      { label: "Headphones / Wireless Earbuds", value: "headphones" },
      { label: "Smartwatch", value: "smartwatch" },
      { label: "Camera / Photography Equipment", value: "camera" },
      { label: "Power Bank / Charger", value: "power_bank" },
      { label: "USB Flash Drive / Hard Drive", value: "storage_device" },
      { label: "Mouse / Keyboard", value: "computer_peripherals" },
      { label: "Other Electronic Device", value: "other_electronics" }
    ]
  },
  {
    label: "Bags & Luggage",
    options: [
      { label: "Backpack", value: "backpack" },
      { label: "Handbag / Purse", value: "handbag" },
      { label: "Suitcase / Travel Bag", value: "suitcase" },
      { label: "Shopping Bag", value: "shopping_bag" }
    ]
  },
  {
    label: "Documents & Cards",
    options: [
      { label: "Student Card / Work ID / Military ID", value: "id_cards" },
      { label: "Transportation Card", value: "transport_card" },
      { label: "Event Ticket / Boarding Pass", value: "tickets" },
      { label: "Important Papers / Forms", value: "documents" },
      { label: "Notebook / Folder / Book", value: "stationery" }
    ]
  },
  {
    label: "Kids & Toys",
    options: [
      { label: "Toys", value: "toys" },
      { label: "Stuffed Animal", value: "stuffed_animal" },
      { label: "Baby Items (Bottle, Pacifier, etc.)", value: "baby_items" }
    ]
  },
  {
    label: "Animals",
    options: [
      { label: "Pet (Dog, Cat, Bird, etc.)", value: "pet" }
    ]
  },
  {
    label: "Medical Items",
    options: [
      { label: "Inhaler", value: "inhaler" },
      { label: "Medication", value: "medication" },
      { label: "Medical Device", value: "medical_device" }
    ]
  },
  {
    label: "Sports & Outdoor Gear",
    options: [
      { label: "Water Bottle", value: "water_bottle" },
      { label: "Sports Equipment", value: "sports_equipment" },
      { label: "Helmet / Pads", value: "protective_gear" }
    ]
  },
  {
    label: "Musical Instruments",
    options: [
      { label: "Guitar", value: "guitar" },
      { label: "Violin", value: "violin" },
      { label: "Other Musical Instrument", value: "other_instrument" }
    ]
  },
  {
    label: "Other",
    options: [
      { label: "Other (Please specify)", value: "other" }
    ]
  }
]; 
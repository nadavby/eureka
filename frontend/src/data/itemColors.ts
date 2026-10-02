export interface ItemColor {
  label: string;
  value: string;
  hexCode?: string; // Optional hex code for visual representation
}

export const itemColors: ItemColor[] = [
  { label: "Red", value: "red", hexCode: "#FF0000" },
  { label: "Blue", value: "blue", hexCode: "#0000FF" },
  { label: "Green", value: "green", hexCode: "#008000" },
  { label: "Yellow", value: "yellow", hexCode: "#FFFF00" },
  { label: "Orange", value: "orange", hexCode: "#FFA500" },
  { label: "Purple", value: "purple", hexCode: "#800080" },
  { label: "Pink", value: "pink", hexCode: "#FFC0CB" },
  { label: "Brown", value: "brown", hexCode: "#A52A2A" },
  { label: "Black", value: "black", hexCode: "#000000" },
  { label: "White", value: "white", hexCode: "#FFFFFF" },
  { label: "Gray", value: "gray", hexCode: "#808080" },
  { label: "Silver", value: "silver", hexCode: "#C0C0C0" },
  { label: "Gold", value: "gold", hexCode: "#FFD700" },
  { label: "Beige", value: "beige", hexCode: "#F5F5DC" },
  { label: "Navy", value: "navy", hexCode: "#000080" },
  { label: "Maroon", value: "maroon", hexCode: "#800000" },
  { label: "Teal", value: "teal", hexCode: "#008080" },
  { label: "Lime", value: "lime", hexCode: "#00FF00" },
  { label: "Cyan", value: "cyan", hexCode: "#00FFFF" },
  { label: "Magenta", value: "magenta", hexCode: "#FF00FF" },
  { label: "Transparent/Clear", value: "transparent", hexCode: "#FFFFFF" },
  { label: "Multi-colored", value: "multicolored" }
];

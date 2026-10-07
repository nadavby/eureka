import { ItemAttributes, ItemType } from "./types";

export interface EmbeddableItem {
  itemType: ItemType;
  category?: string;
  brand?: string;
  colors?: string[];
  material?: string;
  description?: string;
  attributes?: ItemAttributes;
}

const clean = (s?: string) => s?.trim().toLowerCase() ?? "";
const list = (...lists: (string[] | undefined)[]) =>
  [...new Set(lists.flat().map(clean).filter(Boolean))].sort();

/**
 * A stable text form of an item, embedded together with its photo. The lost/found
 * flag is left out so a lost item and the found copy of it end up close together.
 */
export const canonicalText = (item: EmbeddableItem): string => {
  const a = item.attributes;
  const fields: [string, string][] = [
    ["category", clean(a?.category) || clean(item.category)],
    ["type", clean(a?.subcategory)],
    ["brand", clean(item.brand) || clean(a?.brand)],
    ["model", clean(a?.model)],
    ["colors", list(item.colors, a?.colors).join(", ")],
    ["material", clean(item.material) || clean(a?.material)],
    ["features", list(a?.distinctiveFeatures).join("; ")],
    ["text", list(a?.visibleText).join("; ")],
    ["description", clean(a?.description)],
    ["owner notes", clean(item.description)],
  ];
  return fields
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
};

import { api } from "@/lib/api";
import type { Item, ItemType } from "@/lib/types";

export interface ItemFilters {
  itemType?: ItemType;
  userId?: string;
  open?: boolean;
}

export const itemKeys = {
  all: ["items"] as const,
  list: (filters: ItemFilters) => ["items", "list", filters] as const,
  detail: (id: string) => ["items", "detail", id] as const,
};

export const listItems = async (filters: ItemFilters) =>
  (
    await api.get<Item[]>("/items", {
      params: { itemType: filters.itemType, userId: filters.userId, open: filters.open ? "true" : undefined },
    })
  ).data;

export const getItem = async (id: string) => (await api.get<Item>(`/items/${id}`)).data;

export interface NewItem {
  itemType: ItemType;
  photo: Blob;
  category: string;
  description?: string;
  colors: string[];
  brand?: string;
  date: Date;
  location: { lat: number; lng: number };
  placeName?: string;
}

export const createItem = async (item: NewItem) => {
  const form = new FormData();
  form.append("itemType", item.itemType);
  form.append("category", item.category);
  form.append("date", item.date.toISOString());
  form.append("location", JSON.stringify(item.location));
  if (item.colors.length) form.append("colors", item.colors.join(","));
  if (item.description) form.append("description", item.description);
  if (item.brand) form.append("brand", item.brand);
  if (item.placeName) form.append("placeName", item.placeName);
  form.append("image", item.photo, "photo.jpg");
  return (await api.post<Item>("/items", form)).data;
};

export const deleteItem = async (id: string) => {
  await api.delete(`/items/${id}`);
};

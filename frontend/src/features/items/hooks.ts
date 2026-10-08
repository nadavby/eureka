import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationSocket } from "@/lib/socket";
import type { Item, ItemStatusEvent } from "@/lib/types";
import { useSession } from "@/features/auth/session";
import { createItem, deleteItem, getItem, ItemFilters, itemKeys, listItems } from "./api";

export const useItems = (filters: ItemFilters, enabled = true) =>
  useQuery({ queryKey: itemKeys.list(filters), queryFn: () => listItems(filters), enabled });

export const useItem = (id: string | undefined) =>
  useQuery({ queryKey: itemKeys.detail(id ?? ""), queryFn: () => getItem(id!), enabled: !!id });

export const useCreateItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createItem,
    onSuccess: (item) => {
      queryClient.setQueryData(itemKeys.detail(item._id), item);
      void queryClient.invalidateQueries({ queryKey: itemKeys.all });
    },
  });
};

export const useDeleteItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: itemKeys.all }),
  });
};

/**
 * Applies `item_status` events from the server to every cached copy of the item,
 * so matching progress shows up live without polling.
 */
export const useLiveItemStatus = () => {
  const { userId } = useSession();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    const socket = notificationSocket();
    const onStatus = (event: ItemStatusEvent) => {
      const patch = (item: Item): Item =>
        item._id === event.itemId ? { ...item, matchingStatus: event.status, matchCount: event.matchCount } : item;
      queryClient.setQueriesData<Item[]>({ queryKey: ["items", "list"] }, (items) => items?.map(patch));
      queryClient.setQueryData<Item>(itemKeys.detail(event.itemId), (item) => (item ? patch(item) : item));
      if (event.status === "done") void queryClient.invalidateQueries({ queryKey: ["matches"] });
    };
    socket.on("item_status", onStatus);
    if (!socket.connected) socket.connect();
    return () => {
      socket.off("item_status", onStatus);
    };
  }, [userId, queryClient]);
};

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Match, User } from "@/lib/types";
import { itemKeys } from "@/features/items/api";
import { useSession } from "@/features/auth/session";

export const matchKeys = {
  mine: (userId: string | null) => ["matches", "mine", userId] as const,
  detail: (id: string) => ["matches", "detail", id] as const,
};

export const useMyMatches = () => {
  const { userId } = useSession();
  return useQuery({
    queryKey: matchKeys.mine(userId),
    queryFn: async () => (await api.get<Match[]>(`/match/user/${userId}`)).data,
    enabled: !!userId,
  });
};

export const useMatch = (id: string | undefined) =>
  useQuery({
    queryKey: matchKeys.detail(id ?? ""),
    queryFn: async () => (await api.get<Match>(`/match/${id}`)).data,
    enabled: !!id,
  });

export const useUser = (id: string | undefined) =>
  useQuery({ queryKey: ["user", id], queryFn: async () => (await api.get<User>(`/auth/${id}`)).data, enabled: !!id });

/** Which side of the match the signed-in user is on, and the other side's ids. */
export const sides = (match: Match, userId: string | null) => {
  const mine = match.userId1 === userId ? 1 : 2;
  return {
    myItemId: mine === 1 ? match.item1Id : match.item2Id,
    otherItemId: mine === 1 ? match.item2Id : match.item1Id,
    otherUserId: mine === 1 ? match.userId2 : match.userId1,
    iConfirmed: mine === 1 ? match.user1Confirmed : match.user2Confirmed,
    theyConfirmed: mine === 1 ? match.user2Confirmed : match.user1Confirmed,
  };
};

export const useConfirmMatch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (matchId: string) =>
      (await api.post<{ status: "PARTIALLY_CONFIRMED" | "FULLY_CONFIRMED"; match: Match }>("/match/confirm", { matchId })).data,
    onSuccess: (res) => {
      queryClient.setQueryData(matchKeys.detail(res.match._id), res.match);
      void queryClient.invalidateQueries({ queryKey: ["matches"] });
      void queryClient.invalidateQueries({ queryKey: itemKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });
};

export const useRejectMatch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (matchId: string) => {
      await api.delete(`/match/${matchId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["matches"] });
      void queryClient.invalidateQueries({ queryKey: itemKeys.all });
    },
  });
};

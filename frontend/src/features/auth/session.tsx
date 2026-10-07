import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { tokens } from "@/lib/tokens";
import { disconnectSockets } from "@/lib/socket";
import type { User } from "@/lib/types";

interface Session {
  userId: string | null;
  user: User | undefined;
  isLoading: boolean;
  signIn: (accessToken: string, refreshToken: string) => void;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export const meQueryKey = (userId: string | null) => ["user", userId] as const;

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState(() => tokens.userId());

  const me = useQuery({
    queryKey: meQueryKey(userId),
    queryFn: async () => (await api.get<User>(`/auth/${userId}`)).data,
    enabled: !!userId,
  });

  const signIn = useCallback((access: string, refresh: string) => {
    tokens.set(access, refresh);
    setUserId(tokens.userId());
  }, []);

  const signOut = useCallback(async () => {
    const refreshToken = tokens.refresh();
    if (refreshToken) await api.post("/auth/logout", { refreshToken }).catch(() => undefined);
    tokens.clear();
    disconnectSockets();
    queryClient.clear();
    setUserId(null);
  }, [queryClient]);

  // The API client signals when the refresh token is no longer valid.
  useEffect(() => {
    const onSignedOut = () => {
      tokens.clear();
      disconnectSockets();
      queryClient.clear();
      setUserId(null);
    };
    window.addEventListener("eureka:signed-out", onSignedOut);
    return () => window.removeEventListener("eureka:signed-out", onSignedOut);
  }, [queryClient]);

  const value = useMemo<Session>(
    () => ({ userId, user: me.data, isLoading: !!userId && me.isLoading, signIn, signOut }),
    [userId, me.data, me.isLoading, signIn, signOut]
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = () => {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside <SessionProvider>");
  return session;
};

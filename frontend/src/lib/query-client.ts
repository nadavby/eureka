import { QueryClient } from "@tanstack/react-query";
import axios from "axios";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // client errors (4xx) will not fix themselves
      retry: (count, err) => {
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        return count < 2 && (!status || status >= 500);
      },
    },
  },
});

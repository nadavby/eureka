import { useEffect, useState } from "react";
import { env } from "./env";

/** How long a healthy server takes to answer before we tell people it is waking up. */
const SLOW_MS = 1500;

let warmup: Promise<boolean> | null = null;

/** Pings /health once per page load. The free API host sleeps when idle and needs ~30-50 s to wake. */
const ping = () =>
  (warmup ??= fetch(`${env.apiUrl}/health`, { signal: AbortSignal.timeout(90_000) })
    .then((r) => r.ok)
    .catch(() => false));

export type ServerState = "checking" | "waking" | "ready" | "down";

/** Starts waking the API as soon as a public page opens, and reports whether it is still asleep. */
export const useServerWarmup = (): ServerState => {
  const [state, setState] = useState<ServerState>("checking");
  useEffect(() => {
    let done = false;
    const slow = setTimeout(() => !done && setState("waking"), SLOW_MS);
    void ping().then((ok) => {
      done = true;
      clearTimeout(slow);
      setState(ok ? "ready" : "down");
    });
    return () => clearTimeout(slow);
  }, []);
  return state;
};

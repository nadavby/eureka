import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSession } from "./session";

/** Routes behind sign-in; remembers where the visitor was going. */
export const RequireAuth = () => {
  const { userId } = useSession();
  const location = useLocation();
  if (!userId) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
};

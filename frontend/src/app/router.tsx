import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { NotFoundPage } from "./NotFoundPage";
import { RouteError } from "./RouteError";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { LandingPage } from "@/features/landing/LandingPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { path: "/", element: <LandingPage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      {
        element: <RequireAuth />,
        children: [],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

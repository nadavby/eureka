import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { NotFoundPage } from "./NotFoundPage";
import { RouteError } from "./RouteError";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { LandingPage } from "@/features/landing/LandingPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { BrowsePage } from "@/features/items/BrowsePage";
import { MyItemsPage } from "@/features/items/MyItemsPage";
import { ReportPage } from "@/features/report/ReportPage";
import { ItemDetailPage } from "@/features/items/ItemDetailPage";
import { MatchPage } from "@/features/matches/MatchPage";

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
        children: [
          { path: "/items", element: <BrowsePage /> },
          { path: "/items/mine", element: <MyItemsPage /> },
          { path: "/report/:type", element: <ReportPage /> },
          { path: "/items/:id", element: <ItemDetailPage /> },
          { path: "/matches/:id", element: <MatchPage /> },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

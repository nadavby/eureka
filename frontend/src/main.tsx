import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "./index.css";
import "./lib/i18n";
import { queryClient } from "./lib/query-client";
import { env } from "./lib/env";
import { ThemeProvider } from "./lib/theme";
import { router } from "./app/router";
import { SessionProvider } from "./features/auth/session";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <GoogleOAuthProvider clientId={env.googleClientId}>
          <SessionProvider>
            <TooltipProvider>
              <RouterProvider router={router} />
              <Toaster richColors position="top-center" />
            </TooltipProvider>
          </SessionProvider>
        </GoogleOAuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
);

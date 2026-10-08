import { ReactNode } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n";

/** Renders with the providers every screen needs, in the given language. */
export const renderWithProviders = async (ui: ReactNode, { lang = "en", route = "/" } = {}) => {
  await i18n.changeLanguage(lang);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>
  );
};

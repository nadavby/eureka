import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "@/test/render";
import { api } from "@/lib/api";
import { tokens } from "@/lib/tokens";
import { SessionProvider } from "@/features/auth/session";
import { LandingPage } from "@/features/landing/LandingPage";

// jsdom has no canvas; the hero is not what this test is about
vi.mock("@/features/landing/ParticleWordmark", () => ({ ParticleWordmark: () => null }));

const fakeJwt = (id: string) => `x.${btoa(JSON.stringify({ _id: id }))}.y`;

describe("Try the demo", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    tokens.clear();
  });

  it("signs in and opens the ready-made match (not the browse page)", async () => {
    vi.spyOn(api, "post").mockResolvedValue({
      data: { accessToken: fakeJwt("507f1f77bcf86cd799439011"), refreshToken: "r", matchId: "m1" },
    });
    vi.spyOn(api, "get").mockResolvedValue({ data: { _id: "507f1f77bcf86cd799439011", userName: "Guest 1234", demoRole: "visitor" } });

    await renderWithProviders(
      <SessionProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/matches/:id" element={<p>match page</p>} />
          <Route path="/items" element={<p>browse page</p>} />
        </Routes>
      </SessionProvider>
    );
    await userEvent.click(screen.getAllByRole("button", { name: "Try the demo" })[0]);
    expect(await screen.findByText("match page")).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith("/auth/demo");
  });
});

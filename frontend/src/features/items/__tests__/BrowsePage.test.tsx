import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { api } from "@/lib/api";
import type { Item } from "@/lib/types";
import { BrowsePage } from "../BrowsePage";

const make = (id: string, over: Partial<Item>): Item => ({
  _id: id.padStart(24, "0"),
  userId: "u",
  itemType: "lost",
  imageUrl: "x.png",
  category: "wallet",
  date: "2026-10-01T00:00:00.000Z",
  location: { lat: 32, lng: 34 },
  colors: [],
  matchingStatus: "done",
  matchCount: 0,
  isResolved: false,
  createdAt: "2026-10-01T00:00:00.000Z",
  ...over,
});

describe("BrowsePage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("asks only for open items and filters by search words", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({
      data: [
        make("1", { description: "brown leather wallet", placeName: "Habima" }),
        make("2", { category: "keys", description: "keys on a red carabiner", itemType: "found" }),
      ],
    });
    await renderWithProviders(<BrowsePage />, { route: "/items" });

    expect(await screen.findByText("2 reports")).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/items", { params: expect.objectContaining({ open: "true" }) });

    await userEvent.type(screen.getByRole("searchbox"), "red carabiner");
    await waitFor(() => expect(screen.getByText("1 report")).toBeInTheDocument());
    expect(screen.getByText("Keys")).toBeInTheDocument();
  });

  it("explains an empty result instead of showing a blank page", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: [] });
    await renderWithProviders(<BrowsePage />, { route: "/items" });
    expect(await screen.findByText("No open reports yet")).toBeInTheDocument();
  });
});

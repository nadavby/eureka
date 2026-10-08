import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { StatusChip } from "../StatusChip";

const item = (over: Partial<Parameters<typeof StatusChip>[0]["item"]> = {}) => ({
  matchingStatus: "done" as const,
  matchCount: 0,
  isResolved: false,
  ...over,
});

describe("StatusChip", () => {
  it.each([
    [item({ matchingStatus: "analyzing" }), "Reading the photo"],
    [item({ matchingStatus: "searching" }), "Looking for matches"],
    [item({ matchingStatus: "failed" }), "Matching failed"],
    [item(), "No match yet"],
    [item({ matchCount: 1 }), "1 match"],
    [item({ matchCount: 3 }), "3 matches"],
    [item({ isResolved: true, matchCount: 1 }), "Returned"],
  ])("shows the right label", async (state, label) => {
    await renderWithProviders(<StatusChip item={state} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("uses Hebrew plural forms", async () => {
    await renderWithProviders(<StatusChip item={item({ matchCount: 2 })} />, { lang: "he" });
    expect(screen.getByText("2 התאמות")).toBeInTheDocument();
  });

  it("announces progress to screen readers while matching runs", async () => {
    await renderWithProviders(<StatusChip item={item({ matchingStatus: "searching" })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Looking for matches");
  });
});

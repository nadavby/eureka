import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { ClaimTag } from "../ClaimTag";
import { TiedTags } from "../TiedTags";

describe("ClaimTag", () => {
  it("prints the tag number left-to-right even in Hebrew, and stamps the type", async () => {
    await renderWithProviders(<ClaimTag id="64f1c2a9e3b7d1a41f2c" itemType="found" imageUrl="x.png" title="ארנק" />, { lang: "he" });
    const number = screen.getByText("#A41F2C");
    expect(number).toHaveAttribute("dir", "ltr");
    expect(screen.getByText("נמצא")).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("rtl");
  });
});

describe("TiedTags", () => {
  it("labels the knot with the score", async () => {
    await renderWithProviders(<TiedTags score={88} left={<div />} right={<div />} />);
    expect(screen.getByLabelText("88% match")).toBeInTheDocument();
  });
});

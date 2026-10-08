import { canonicalText } from "../../matching/embedding";

describe("canonicalText", () => {
  const base = {
    itemType: "lost" as const,
    category: "Wallet",
    brand: "Fossil",
    colors: ["Brown", "black"],
    description: "Leather wallet with a torn corner",
    attributes: {
      category: "wallet",
      subcategory: "bifold wallet",
      brand: "Fossil",
      model: "",
      colors: ["brown"],
      material: "leather",
      distinctiveFeatures: ["torn bottom-left corner", "initials N.B. embossed"],
      visibleText: ["FOSSIL"],
      description: "A brown leather bifold wallet",
    },
  };

  it("is deterministic and lower-cased", () => {
    const a = canonicalText(base);
    expect(a).toBe(canonicalText({ ...base }));
    expect(a).toBe(a.toLowerCase());
  });

  it("orders lists stably regardless of input order", () => {
    const reordered = { ...base, colors: ["black", "Brown"] };
    expect(canonicalText(reordered)).toBe(canonicalText(base));
  });

  it("includes the details that identify a specific object", () => {
    const text = canonicalText(base);
    expect(text).toContain("bifold wallet");
    expect(text).toContain("initials n.b. embossed");
    expect(text).toContain("fossil");
    expect(text).toContain("leather");
  });

  it("does not depend on whether the item is lost or found", () => {
    expect(canonicalText({ ...base, itemType: "found" })).toBe(canonicalText(base));
  });

  it("skips empty fields", () => {
    const text = canonicalText({ itemType: "found", category: "Keys", attributes: undefined });
    expect(text).toBe("category: keys");
  });
});

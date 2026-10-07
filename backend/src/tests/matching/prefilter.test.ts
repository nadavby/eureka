import { distanceKm, isPlausiblePair } from "../../matching/prefilter";
import { MatchableItem } from "../../matching/types";

const telAviv = { lat: 32.0853, lng: 34.7818 };
// ~9 km and ~11 km north of telAviv (1° latitude ≈ 111.2 km)
const nineKm = { lat: telAviv.lat + 9 / 111.2, lng: telAviv.lng };
const elevenKm = { lat: telAviv.lat + 11 / 111.2, lng: telAviv.lng };

const lost = (o: Partial<MatchableItem> = {}): MatchableItem => ({
  _id: "lost1",
  itemType: "lost",
  category: "Wallet",
  date: new Date("2026-01-10T10:00:00Z"),
  location: telAviv,
  isResolved: false,
  ...o,
});
const found = (o: Partial<MatchableItem> = {}): MatchableItem => ({
  _id: "found1",
  itemType: "found",
  category: "Wallet",
  date: new Date("2026-01-11T10:00:00Z"),
  location: nineKm,
  isResolved: false,
  ...o,
});

describe("distanceKm", () => {
  it("computes great-circle distance", () => {
    expect(distanceKm(telAviv, nineKm)).toBeCloseTo(9, 0);
    expect(distanceKm(telAviv, telAviv)).toBe(0);
  });
});

describe("isPlausiblePair", () => {
  const opts = { radiusKm: 10 };

  it("accepts a nearby, later, same-category pair in either order", () => {
    expect(isPlausiblePair(lost(), found(), opts)).toBe(true);
    expect(isPlausiblePair(found(), lost(), opts)).toBe(true);
  });

  it("rejects items of the same type", () => {
    expect(isPlausiblePair(lost(), lost({ _id: "lost2" }), opts)).toBe(false);
  });

  it("rejects different categories, case-insensitively accepting the same one", () => {
    expect(isPlausiblePair(lost(), found({ category: "Phone" }), opts)).toBe(false);
    expect(isPlausiblePair(lost(), found({ category: "wallet " }), opts)).toBe(true);
  });

  it("rejects items found well before they were lost, with a one-day tolerance", () => {
    expect(isPlausiblePair(lost(), found({ date: new Date("2026-01-08T10:00:00Z") }), opts)).toBe(false);
    // reported "found" a few hours before the owner's "lost" date: still plausible (dates are approximate)
    expect(isPlausiblePair(lost(), found({ date: new Date("2026-01-10T02:00:00Z") }), opts)).toBe(true);
  });

  it("enforces the radius", () => {
    expect(isPlausiblePair(lost(), found({ location: elevenKm }), opts)).toBe(false);
    expect(isPlausiblePair(lost(), found({ location: elevenKm }), { radiusKm: 12 })).toBe(true);
  });

  it("does not exclude on missing data", () => {
    expect(isPlausiblePair(lost({ location: undefined, date: undefined, category: undefined }), found(), opts)).toBe(true);
  });

  it("rejects resolved items and an item paired with itself", () => {
    expect(isPlausiblePair(lost(), found({ isResolved: true }), opts)).toBe(false);
    expect(isPlausiblePair(lost(), found({ _id: "lost1" }), opts)).toBe(false);
  });
});

import { LatLng, MatchableItem } from "./types";

const EARTH_RADIUS_KM = 6371;
// People rarely know the exact time; a found report may predate the lost report by up to a day.
const DATE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle (haversine) distance between two points, in kilometres. */
export const distanceKm = (a: LatLng, b: LatLng): number => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const asLatLng = (location: MatchableItem["location"]): LatLng | null =>
  location && typeof location === "object" && Number.isFinite(location.lat) && Number.isFinite(location.lng)
    ? location
    : null;

const normalize = (s?: string) => s?.trim().toLowerCase() || undefined;

/**
 * Cheap deterministic rules a pair must pass before any AI call.
 * Missing data never excludes a pair: only evidence that contradicts a match does.
 */
export const isPlausiblePair = (a: MatchableItem, b: MatchableItem, opts: { radiusKm: number }): boolean => {
  if (a._id === b._id || a.itemType === b.itemType) return false;
  if (a.isResolved || b.isResolved) return false;

  const [lost, found] = a.itemType === "lost" ? [a, b] : [b, a];

  const catLost = normalize(lost.category);
  const catFound = normalize(found.category);
  if (catLost && catFound && catLost !== catFound) return false;

  if (lost.date && found.date && new Date(found.date).getTime() < new Date(lost.date).getTime() - DATE_TOLERANCE_MS) {
    return false;
  }

  const p1 = asLatLng(lost.location);
  const p2 = asLatLng(found.location);
  if (p1 && p2 && distanceKm(p1, p2) > opts.radiusKm) return false;

  return true;
};

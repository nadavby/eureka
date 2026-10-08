import L from "leaflet";
import "leaflet/dist/leaflet.css";

/** Map pin drawn as a small manila claim tag (avoids Leaflet's default icons, which break under bundlers). */
export const tagPin = (itemType: "lost" | "found" | "draft" = "draft") =>
  L.divIcon({
    className: "",
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32],
    html: `<span class="eureka-pin eureka-pin--${itemType}" aria-hidden="true"><span></span></span>`,
  });

export const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Tel Aviv, used until we know where the user is. */
export const DEFAULT_CENTER: [number, number] = [32.0853, 34.7818];

/**
 * Reverse-geocodes a point to a short place name ("Habima Square, Tel Aviv") via OpenStreetMap Nominatim.
 * Best effort: returns undefined on any failure. Called only when the pin settles (Nominatim allows ~1 request/second).
 */
export const placeNameAt = async (lat: number, lng: number, lang: string): Promise<string | undefined> => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&lat=${lat}&lon=${lng}&accept-language=${lang}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { address?: Record<string, string> };
    const a = data.address ?? {};
    const spot = a.amenity || a.road || a.pedestrian || a.square || a.neighbourhood || a.suburb;
    const city = a.city || a.town || a.village || a.municipality;
    return [spot, city].filter(Boolean).join(", ") || undefined;
  } catch {
    return undefined;
  }
};

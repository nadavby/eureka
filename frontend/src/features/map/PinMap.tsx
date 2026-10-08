import { MapContainer, Marker, TileLayer } from "react-leaflet";
import { TILE_ATTRIBUTION, TILE_URL, tagPin } from "./leaflet";

/** A small read-only map with one pin. */
export const PinMap = ({ lat, lng, itemType }: { lat: number; lng: number; itemType: "lost" | "found" }) => (
  <div className="h-48 overflow-hidden rounded-lg border">
    <MapContainer
      center={[lat, lng]}
      zoom={15}
      className="size-full"
      scrollWheelZoom={false}
      dragging={false}
      doubleClickZoom={false}
      zoomControl={false}
      attributionControl
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <Marker position={[lat, lng]} icon={tagPin(itemType)} interactive={false} keyboard={false} />
    </MapContainer>
  </div>
);

import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { LatLngLiteral, Marker as LeafletMarker } from "leaflet";
import { useTranslation } from "react-i18next";
import { LocateFixed, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_CENTER, TILE_ATTRIBUTION, TILE_URL, tagPin } from "./leaflet";

interface Props {
  value: LatLngLiteral | null;
  onChange: (point: LatLngLiteral) => void;
  itemType: "lost" | "found";
}

const ClickToPlace = ({ onChange }: { onChange: (p: LatLngLiteral) => void }) => {
  useMapEvents({ click: (e) => onChange(e.latlng) });
  return null;
};

const FlyTo = ({ point }: { point: LatLngLiteral | null }) => {
  const map = useMap();
  useEffect(() => {
    if (point) map.flyTo(point, Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [map, point]);
  return null;
};

/** Tap the map or drag the pin to where the item was lost or found. */
export const LocationPicker = ({ value, onChange, itemType }: Props) => {
  const { t } = useTranslation();
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState(false);
  const [flyTarget, setFlyTarget] = useState<LatLngLiteral | null>(null);

  const useMyLocation = () => {
    if (!navigator.geolocation) return setLocateError(true);
    setLocating(true);
    setLocateError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onChange(point);
        setFlyTarget(point);
        setLocating(false);
      },
      () => {
        setLocateError(true);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  };

  return (
    <div className="space-y-2">
      <div className="relative h-72 overflow-hidden rounded-lg border sm:h-80">
        <MapContainer center={value ?? DEFAULT_CENTER} zoom={value ? 16 : 13} className="size-full" scrollWheelZoom>
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
          <ClickToPlace onChange={onChange} />
          <FlyTo point={flyTarget} />
          {value && (
            <Marker
              position={value}
              icon={tagPin(itemType)}
              draggable
              keyboard
              eventHandlers={{ dragend: (e) => onChange((e.target as LeafletMarker).getLatLng()) }}
            />
          )}
        </MapContainer>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={locating}>
          {locating ? <Loader2 className="animate-spin" /> : <LocateFixed />}
          {t("report.useMyLocation")}
        </Button>
        <p className="text-xs text-muted-foreground">{locateError ? t("report.locateFailed") : t("report.mapHint")}</p>
      </div>
    </div>
  );
};

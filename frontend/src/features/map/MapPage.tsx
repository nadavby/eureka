import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { latLngBounds } from "leaflet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ErrorState, PageHeader } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import type { ItemType } from "@/lib/types";
import { useItems } from "@/features/items/hooks";
import { useItemTitle } from "@/features/items/title";
import { useSearchParams } from "react-router-dom";
import { DEFAULT_CENTER, TILE_ATTRIBUTION, TILE_URL, tagPin } from "./leaflet";

export const MapPage = () => {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const type = (params.get("type") as ItemType | null) ?? undefined;
  const items = useItems({ itemType: type, open: true });
  const title = useItemTitle();
  const placed = (items.data ?? []).filter((i) => Number.isFinite(i.location?.lat) && Number.isFinite(i.location?.lng));
  const bounds = placed.length > 1 ? latLngBounds(placed.map((i) => [i.location.lat, i.location.lng])) : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title={t("map.title")}
        lead={t("map.lead")}
        actions={
          <ToggleGroup
            type="single"
            variant="outline"
            value={type ?? "all"}
            onValueChange={(v) => setParams(v && v !== "all" ? { type: v } : {}, { replace: true })}
            aria-label={t("browse.typeFilter")}
          >
            <ToggleGroupItem value="all">{t("browse.all")}</ToggleGroupItem>
            <ToggleGroupItem value="lost">{t("tag.lost")}</ToggleGroupItem>
            <ToggleGroupItem value="found">{t("tag.found")}</ToggleGroupItem>
          </ToggleGroup>
        }
      />
      {items.isPending ? (
        <Skeleton className="h-[65vh] rounded-xl" />
      ) : items.isError ? (
        <ErrorState message={errorMessage(items.error, t("auth.networkError"))} onRetry={() => void items.refetch()} />
      ) : (
        <div className="h-[65vh] overflow-hidden rounded-xl border">
          <MapContainer
            key={`${type ?? "all"}-${placed.length}`}
            center={placed[0] ? [placed[0].location.lat, placed[0].location.lng] : DEFAULT_CENTER}
            zoom={13}
            bounds={bounds}
            boundsOptions={{ padding: [40, 40] }}
            className="size-full"
          >
            <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
            {placed.map((item) => (
              <Marker key={item._id} position={[item.location.lat, item.location.lng]} icon={tagPin(item.itemType)}>
                <Popup>
                  <Link to={`/items/${item._id}`} className="flex w-48 gap-2 text-inherit no-underline">
                    <img src={item.imageUrl} alt="" className="size-14 shrink-0 rounded object-cover" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{title(item)}</span>
                      <span className="block text-xs opacity-70">{t(`tag.${item.itemType}`)} · {formatDate(item.date, i18n.resolvedLanguage ?? "en")}</span>
                      {item.placeName && <span className="block truncate text-xs opacity-70">{item.placeName}</span>}
                    </span>
                  </Link>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
};

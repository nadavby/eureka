import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState, ErrorState, PageHeader, TagGridSkeleton } from "@/components/states";
import { CATEGORIES } from "@/lib/catalog";
import { errorMessage } from "@/lib/api";
import type { Item, ItemType } from "@/lib/types";
import { useItems } from "./hooks";
import { ItemTag } from "./ItemTag";

const matchesSearch = (item: Item, q: string) => {
  if (!q) return true;
  const haystack = [item.description, item.brand, item.placeName, item.category, item.attributes?.description, item.attributes?.subcategory, ...(item.colors ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
};

export const BrowsePage = () => {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const type = (params.get("type") as ItemType | null) ?? undefined;
  const category = params.get("category") ?? "";
  const q = params.get("q") ?? "";

  const update = (key: string, value: string | undefined) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );

  const items = useItems({ itemType: type, open: true });
  const visible = useMemo(
    () => (items.data ?? []).filter((i) => (!category || i.category === category) && matchesSearch(i, q)),
    [items.data, category, q]
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader title={t("browse.title")} lead={t("browse.lead")} />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={q}
            onChange={(e) => update("q", e.target.value)}
            placeholder={t("browse.searchPlaceholder")}
            aria-label={t("browse.search")}
            className="ps-9"
          />
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          value={type ?? "all"}
          onValueChange={(v) => update("type", v === "all" || !v ? undefined : v)}
          aria-label={t("browse.typeFilter")}
        >
          <ToggleGroupItem value="all">{t("browse.all")}</ToggleGroupItem>
          <ToggleGroupItem value="lost">{t("tag.lost")}</ToggleGroupItem>
          <ToggleGroupItem value="found">{t("tag.found")}</ToggleGroupItem>
        </ToggleGroup>
        <Select value={category || "any"} onValueChange={(v) => update("category", v === "any" ? undefined : v)}>
          <SelectTrigger className="sm:w-48" aria-label={t("browse.category")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t("browse.anyCategory")}</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {t(`categories.${c}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {items.isPending ? (
        <TagGridSkeleton />
      ) : items.isError ? (
        <ErrorState message={errorMessage(items.error, t("auth.networkError"))} onRetry={() => void items.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={q || category || type ? t("browse.noResults") : t("browse.empty")}
          body={q || category || type ? t("browse.noResultsBody") : t("browse.emptyBody")}
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
            {t("browse.count", { count: visible.length })}
          </p>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((item) => (
              <li key={item._id}>
                <ItemTag item={item} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ClaimTag } from "@/components/claim-tag/ClaimTag";
import { formatDate } from "@/lib/dates";
import type { Item } from "@/lib/types";
import { useItemTitle } from "./title";

/** An item rendered as a claim tag that links to its page. */
export const ItemTag = ({ item, footer }: { item: Item; footer?: ReactNode }) => {
  const { i18n } = useTranslation();
  const title = useItemTitle();
  return (
    <Link
      to={`/items/${item._id}`}
      className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <ClaimTag
        id={item._id}
        itemType={item.itemType}
        imageUrl={item.imageUrl}
        title={title(item)}
        meta={
          <span className="flex flex-col gap-0.5">
            {item.placeName && <span className="line-clamp-1">{item.placeName}</span>}
            <span className="font-mono">{formatDate(item.date, i18n.resolvedLanguage ?? "en")}</span>
          </span>
        }
        footer={footer}
        className="h-full"
      />
    </Link>
  );
};

import { useTranslation } from "react-i18next";
import { isKnownCategory } from "@/lib/catalog";
import type { Item } from "@/lib/types";

/** Display title: the specific type the AI recognised, else the category label. */
export const useItemTitle = () => {
  const { t } = useTranslation();
  return (item: Pick<Item, "category" | "attributes">) =>
    item.attributes?.subcategory ||
    (isKnownCategory(item.category) ? t(`categories.${item.category}`) : item.category);
};

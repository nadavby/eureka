import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageHeader, TagGridSkeleton } from "@/components/states";
import { errorMessage } from "@/lib/api";
import { useSession } from "@/features/auth/session";
import { useItems } from "./hooks";
import { ItemTag } from "./ItemTag";
import { StatusChip } from "./StatusChip";

export const MyItemsPage = () => {
  const { t } = useTranslation();
  const { userId } = useSession();
  const items = useItems({ userId: userId ?? undefined }, !!userId);

  const actions = (
    <div className="flex gap-2">
      <Button asChild>
        <Link to="/report/lost">
          <Plus /> {t("nav.reportLost")}
        </Link>
      </Button>
      <Button asChild variant="outline">
        <Link to="/report/found">{t("nav.reportFound")}</Link>
      </Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader title={t("mine.title")} lead={t("mine.lead")} actions={items.data?.length ? actions : undefined} />
      {items.isPending ? (
        <TagGridSkeleton count={4} />
      ) : items.isError ? (
        <ErrorState message={errorMessage(items.error, t("auth.networkError"))} onRetry={() => void items.refetch()} />
      ) : items.data.length === 0 ? (
        <EmptyState title={t("mine.empty")} body={t("mine.emptyBody")} action={actions} />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.data.map((item) => (
            <li key={item._id}>
              <ItemTag item={item} footer={<StatusChip item={item} />} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

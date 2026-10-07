import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, TagGridSkeleton } from "@/components/states";
import { NotFoundPage } from "@/app/NotFoundPage";
import { useItems } from "@/features/items/hooks";
import { ItemTag } from "@/features/items/ItemTag";
import { useUser } from "@/features/matches/api";

/** What anyone can see about a user: name, photo and their open reports. Contact details stay private. */
export const PublicProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const user = useUser(id);
  const items = useItems({ userId: id, open: true }, !!id);

  if (user.isError && axios.isAxiosError(user.error) && [400, 404].includes(user.error.response?.status ?? 0)) {
    return <NotFoundPage />;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center gap-4">
        {user.data ? (
          <>
            <Avatar className="size-16">
              {user.data.imgURL && <AvatarImage src={user.data.imgURL} alt="" />}
              <AvatarFallback>{user.data.userName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">{user.data.userName}</h1>
              <p className="text-sm text-muted-foreground">{t("profile.publicLead")}</p>
            </div>
          </>
        ) : (
          <Skeleton className="h-16 w-64" />
        )}
      </div>
      {items.isPending ? (
        <TagGridSkeleton count={4} />
      ) : (items.data ?? []).length === 0 ? (
        <EmptyState title={t("profile.noOpenReports")} />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.data!.map((item) => (
            <li key={item._id}>
              <ItemTag item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

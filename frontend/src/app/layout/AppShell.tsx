import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogOut, Map, Menu, MessageCircle, Plus, Search, Tags, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Wordmark } from "@/components/brand/Wordmark";
import { useSession } from "@/features/auth/session";
import { useLiveItemStatus } from "@/features/items/hooks";
import { NotificationsBell } from "@/features/notifications/NotificationsBell";
import { DemoBanner } from "@/features/demo/DemoBanner";
import { cn } from "@/lib/utils";
import { LanguageMenu, ThemeMenu } from "./Preferences";

const NAV = [
  { to: "/items", key: "nav.browse", icon: Search, end: true },
  { to: "/items/mine", key: "nav.myItems", icon: Tags },
  { to: "/map", key: "nav.map", icon: Map },
  { to: "/chats", key: "nav.chats", icon: MessageCircle },
] as const;

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
    isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
  );

const initials = (name?: string) => (name ?? "?").trim().slice(0, 2).toUpperCase();

const ReportMenu = ({ compact = false }: { compact?: boolean }) => {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={compact ? "icon" : "default"} aria-label={compact ? t("nav.report") : undefined}>
          <Plus />
          {!compact && t("nav.report")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link to="/report/lost">{t("nav.reportLost")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/report/found">{t("nav.reportFound")}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const UserMenu = () => {
  const { t } = useTranslation();
  const { user, signOut } = useSession();
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={t("nav.profile")}>
          <Avatar className="size-8">
            {user?.imgURL && <AvatarImage src={user.imgURL} alt="" />}
            <AvatarFallback className="text-xs">{initials(user?.userName)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <div className="px-2 py-1.5 text-sm font-medium">{user?.userName}</div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile">
            <UserIcon /> {t("nav.profile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            await signOut();
            navigate("/");
          }}
        >
          <LogOut className="rtl:-scale-x-100" /> {t("nav.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const MobileNav = () => {
  const { t, i18n } = useTranslation();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("nav.menu")}>
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side={i18n.dir() === "rtl" ? "right" : "left"} className="w-72">
        <SheetHeader>
          <SheetTitle>
            <Wordmark />
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4">
          {NAV.map(({ to, key, icon: Icon, ...rest }) => (
            <NavLink key={to} to={to} className={navClass} end={"end" in rest}>
              <Icon className="size-4" /> {t(key)}
            </NavLink>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
};

export const AppShell = () => {
  const { t } = useTranslation();
  const { userId } = useSession();
  useLiveItemStatus();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        {t("app.skipToContent")}
      </a>
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          {userId && <MobileNav />}
          <Link to={userId ? "/items" : "/"} className="me-2 rounded-sm" aria-label={t("app.name")}>
            <Wordmark />
          </Link>
          {userId && (
            <nav className="hidden items-center gap-1 md:flex">
              {NAV.map(({ to, key, icon: Icon, ...rest }) => (
                <NavLink key={to} to={to} className={navClass} end={"end" in rest}>
                  <Icon className="size-4" /> {t(key)}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="ms-auto flex items-center gap-1">
            <LanguageMenu />
            <ThemeMenu />
            {userId ? (
              <>
                <span className="hidden sm:inline-flex">
                  <ReportMenu />
                </span>
                <span className="sm:hidden">
                  <ReportMenu compact />
                </span>
                <NotificationsBell />
                <UserMenu />
              </>
            ) : (
              <Button asChild variant="ghost">
                <Link to="/login">{t("nav.signIn")}</Link>
              </Button>
            )}
          </div>
        </div>
      </header>
      <DemoBanner />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
    </div>
  );
};

import { createFileRoute, redirect, Outlet, Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AnimatedBg } from "@/components/animated-bg";
import { AvatarCircle } from "@/components/avatar-circle";
import { NotificationsBell } from "@/components/notifications-bell";
import { useMyProfile } from "@/lib/use-profile";
import { cn } from "@/lib/utils";
import { Home, Plus, Users, Archive, Settings as SettingsIcon, LogOut, Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: AuthedLayout,
});

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  adminOnly?: boolean;       // admins only (not owner)
  adminOrOwner?: boolean;    // both admins and owner
}

const NAV: NavItem[] = [
  { to: "/dashboard",     label: "لوحة التحكم", icon: Home },
  { to: "/add-task",      label: "إضافة مهمة",  icon: Plus, adminOnly: true },
  { to: "/add-colleague", label: "إضافة زميل",  icon: Users, adminOnly: true },
  { to: "/archive",       label: "Archive",     icon: Archive, adminOrOwner: true },
  { to: "/settings",      label: "الإعدادات",   icon: SettingsIcon },
];

function AuthedLayout() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: me } = useMyProfile();
  const [open, setOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  const isOwner = me?.role === "owner";
  const isAdmin = me?.role === "admin";
  const items = NAV.filter((n) => {
    if (n.adminOnly) return isAdmin;
    if (n.adminOrOwner) return isAdmin || isOwner;
    return true;
  });

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen relative">
      <AnimatedBg />

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 glass border-b flex items-center justify-between px-3 h-14 text-sidebar-foreground">
        <button
          aria-label="فتح القائمة"
          className="h-11 w-11 inline-flex items-center justify-center rounded-lg hover:bg-accent"
          onClick={() => setOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="font-bold">Ai Tasks Solutions</span>
          <img src="/logo.png" alt="Ai Tasks Solutions" style={{ height: 36 }} className="w-auto object-contain" />
        </div>
      </header>

      {/* Sidebar (right) */}
      <aside
        className={cn(
          "fixed top-0 right-0 h-full w-[248px] z-40 glass border-l flex flex-col text-sidebar-foreground",
          "transition-transform duration-200",
          "md:translate-x-0",
          open ? "translate-x-0" : "translate-x-full md:translate-x-0",
        )}
      >
        {/* Logo */}
        <div className="p-4 flex items-center justify-between gap-3 border-b">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Ai Tasks Solutions" style={{ height: 36 }} className="w-auto object-contain" />
            <div className="leading-tight">
              <div className="font-bold text-sm">Ai Tasks</div>
              <div className="text-[11px] text-muted-foreground">Solutions</div>
            </div>
          </div>
          <button
            aria-label="إغلاق"
            className="md:hidden h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-accent"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map((it) => {
            const active = pathname === it.to || pathname.startsWith(it.to + "/");
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "flex items-center gap-3 px-3 h-11 rounded-lg transition-colors text-sm font-medium",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-accent",
                )}
              >
                <it.icon className="h-4 w-4 shrink-0" />
                <span>{it.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer: user + bell + logout */}
        <div className="border-t p-3 space-y-2">
          {me && (
            <div className="flex items-center gap-3 px-2">
              <AvatarCircle name={me.full_name} color={me.color} size={38} />
              <div className="leading-tight min-w-0">
                <div className="font-semibold text-sm truncate">{me.full_name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {me.role === "owner" ? "Owner" : me.role === "admin" ? "Admin" : "موظف"}
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 px-1">
            <NotificationsBell />
            <Button
              variant="ghost" size="sm" className="flex-1 justify-start gap-2"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" />
              <span>تسجيل خروج</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {open && (
        <button
          aria-label="إغلاق القائمة"
          className="md:hidden fixed inset-0 z-30 bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <main className="md:mr-[248px] p-4 md:p-7 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}

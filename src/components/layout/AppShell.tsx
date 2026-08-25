import { Link, Outlet, useLocation } from "react-router-dom";
import { Gauge, LayoutDashboard, Settings, ShieldCheck, Zap } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useAppData } from "@/state/useAppData";
import { useLogout } from "@/state/useLogout";

// `requiresContract` pages are meaningless without a meter — hidden whenever the
// logged-in account has none (an admin with no personal contract, most commonly).
// Settings stays available regardless: its Profile tab is account-level, not meter-level.
const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, requiresContract: true },
  { to: "/reading", label: "Daily Reading", icon: Gauge, requiresContract: true },
  { to: "/settings", label: "Settings", icon: Settings, requiresContract: false },
];

const ADMIN_NAV_ITEMS = [{ to: "/admin/tariffs", label: "Tariff Management", icon: ShieldCheck, requiresContract: false }];

function LogoutButton() {
  const logout = useLogout();
  return <button onClick={logout} className="px-2 py-1 text-sm hover:underline">Log out</button>;
}

export function AppShell() {
  const location = useLocation();
  const { user, contract } = useAppData();

  const allItems = user?.role === "ADMIN" ? [...NAV_ITEMS, ...ADMIN_NAV_ITEMS] : NAV_ITEMS;
  const navItems = allItems.filter((item) => !item.requiresContract || contract);
  const activeItem = navItems.find((item) => item.to === location.pathname);

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Zap className="size-5 shrink-0 text-primary" />
            <span className="truncate font-semibold group-data-[collapsible=icon]:hidden">Power Meter</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      render={<Link to={item.to} />}
                      isActive={item.to === location.pathname}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-medium">{activeItem?.label ?? "Power Meter"}</h1>
            {user && <span className="text-xs text-muted-foreground">{user.firstName} {user.lastName}</span>}
          </div>
          <LogoutButton />
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default AppShell;
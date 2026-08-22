import { Link, Outlet, useLocation } from "react-router-dom";
import { Gauge, LayoutDashboard, Settings, Zap } from "lucide-react";
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
import { Toaster } from "@/components/ui/sonner";
import { useAppData } from "@/state/useAppData";
import { useAuthContext } from "@/state/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/reading", label: "Daily Reading", icon: Gauge },
  { to: "/settings", label: "Settings", icon: Settings },
];

function LogoutButton() {
  const { isAuthenticated } = useAuthContext();

  async function handleLogout() {
    if (isAuthenticated) {
      try {
        // Direct localStorage manipulation to avoid auth errors
        localStorage.removeItem("auth_token");
        window.location.href = "/login";
      } catch (error) {
        console.error("Logout failed", error);
      }
    }
  }

  return <button onClick={handleLogout} className="px-2 py-1 text-sm hover:underline">Log out</button>;
}

export function AppShell() {
  const location = useLocation();
  const { config, user } = useAppData();

  const activeItem = NAV_ITEMS.find((item) => item.to === location.pathname);

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
                {NAV_ITEMS.map((item) => (
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
            <h1 className="text-sm font-medium">{activeItem?.label ?? config.tariff.planName}</h1>
            {user && <span className="text-xs text-muted-foreground">{user.name}</span>}
          </div>
          <LogoutButton />
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}

export default AppShell;
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Clock,
  MessageSquare,
  Wallet,
  Palette,
  CreditCard,
  Settings,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Patients", url: "/patients", icon: Users },
  { title: "Sessions", url: "/sessions", icon: CalendarDays },
  { title: "Availability", url: "/availability", icon: Clock },
  { title: "Feedback", url: "/feedback", icon: MessageSquare },
  { title: "Revenue", url: "/revenue", icon: Wallet },
  { title: "Branding", url: "/branding", icon: Palette },
  { title: "Billing", url: "/billing", icon: CreditCard },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

export function AppSidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [clinicName, setClinicName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("clinics")
        .select("name")
        .limit(1)
        .maybeSingle();
      if (active && data?.name) setClinicName(data.name as string);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login", search: { redirect: "/dashboard" } });
  };

  return (
    <Sidebar
      collapsible="none"
      className="w-60 border-r border-sidebar-border bg-sidebar"
    >
      <SidebarHeader className="px-5 pt-6 pb-4">
        <div
          className="font-display font-bold leading-none text-primary"
          style={{ fontSize: "28px" }}
        >
          KinetiMap
        </div>
        <div className="mt-2 truncate text-sm text-foreground/70">
          {clinicName ?? "My Clinic"}
        </div>
      </SidebarHeader>
      <SidebarContent className="px-3">
        <SidebarMenu className="gap-1">
          {items.map((item) => {
            const isActive = location.pathname === item.url;
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  className={cn(
                    "h-10 rounded-lg px-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                      : "text-foreground hover:bg-accent/20 hover:text-foreground",
                  )}
                >
                  <Link to={item.url}>
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border px-4 py-4">
        <div className="flex flex-col gap-2">
          <span className="truncate text-xs text-foreground/60">{user?.email ?? "User"}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

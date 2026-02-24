"use client";

import * as React from "react";
import {
  Activity,
  BarChartIcon,
  Calendar,
  LayoutDashboardIcon,
  ListIcon,
  Upload,
} from "lucide-react";
import { usePathname } from "next/navigation";

import { NavMain } from "@/components/examples/dashboard/components/nav-main";
import { SettingsSheet } from "@/components/entrenamientos/settings-sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const data = {
  navMain: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboardIcon },
    { title: "Sesiones", url: "/dashboard/sesiones", icon: ListIcon },
    { title: "Calendario", url: "/dashboard/calendario", icon: Calendar },
    { title: "Análisis", url: "/dashboard/analisis", icon: BarChartIcon },
  ],
  quickAction: {
    title: "Importar archivo",
    url: "/entrenamientos",
    icon: Upload,
    tooltip: "Importar archivo de entrenamientos",
  },
};

export function EntrenamientosAppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isDashboardActive =
    mounted && (pathname === "/dashboard" || pathname?.startsWith("/dashboard"));

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5" isActive={isDashboardActive}>
              <a href="/dashboard">
                <Activity className="h-5 w-5" />
                <span className="text-base font-semibold">Entrenamientos</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} quickAction={data.quickAction} />
        <div className="mt-auto flex flex-col gap-1">
          <SettingsSheet />
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

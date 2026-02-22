import * as React from "react";
import {
  Activity,
  BarChartIcon,
  Heart,
  LayoutDashboardIcon,
  LayoutTemplateIcon,
  ListIcon,
  Upload,
} from "lucide-react";

import { NavMain } from "@/components/examples/dashboard/components/nav-main";
import { NavSecondary } from "@/components/examples/dashboard/components/nav-secondary";
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
    { title: "Sesiones", url: "/dashboard", icon: ListIcon },
    { title: "Frecuencia Cardíaca", url: "/dashboard", icon: Heart },
    { title: "Estadísticas", url: "/dashboard", icon: BarChartIcon },
    { title: "Demo Tweakcn", url: "/dashboard/tweakcn", icon: LayoutTemplateIcon },
  ],
  navSecondary: [{ title: "Cargar datos", url: "/", icon: Upload }],
};

export function EntrenamientosAppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <a href="/dashboard">
                <Activity className="h-5 w-5" />
                <span className="text-base font-semibold">Entrenamientos</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <div className="mt-auto flex flex-col gap-1">
          <NavSecondary items={data.navSecondary} />
          <SettingsSheet />
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

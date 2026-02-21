"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { EntrenamientosAppSidebar } from "@/components/entrenamientos/app-sidebar";
import { EntrenamientosSiteHeader } from "@/components/entrenamientos/site-header";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <EntrenamientosAppSidebar variant="inset" />
      <SidebarInset>
        <EntrenamientosSiteHeader />
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

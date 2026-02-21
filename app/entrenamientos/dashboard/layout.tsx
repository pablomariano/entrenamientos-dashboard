"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { EntrenamientosAppSidebar } from "@/components/entrenamientos/app-sidebar";
import { EntrenamientosSiteHeader } from "@/components/entrenamientos/site-header";
import { TangerineThemeWrapper } from "@/components/entrenamientos/theme-wrapper";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TangerineThemeWrapper>
      <SidebarProvider>
        <EntrenamientosAppSidebar variant="inset" />
        <SidebarInset>
          <EntrenamientosSiteHeader />
          <div className="flex flex-1 flex-col">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TangerineThemeWrapper>
  );
}

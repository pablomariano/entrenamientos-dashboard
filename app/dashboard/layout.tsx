"use client";

import React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { EntrenamientosAppSidebar } from "@/components/entrenamientos/app-sidebar";
import { EntrenamientosSiteHeader } from "@/components/entrenamientos/site-header";

export default function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params?: Promise<Record<string, string | string[]>>;
}) {
  React.use(params ?? Promise.resolve({}));
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

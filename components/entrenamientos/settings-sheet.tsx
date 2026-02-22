"use client";

import { useState } from "react";
import { SettingsIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function SettingsSheet() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SheetTrigger asChild>
                <SidebarMenuButton>
                  <SettingsIcon />
                  <span>Configuración</span>
                </SidebarMenuButton>
              </SheetTrigger>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Configuración</SheetTitle>
          <SheetDescription>Personaliza la aplicación según tus preferencias</SheetDescription>
        </SheetHeader>
        <div className="mt-8 space-y-6">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Apariencia</h4>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <div>
                  <p className="text-sm font-medium">Modo oscuro</p>
                  <p className="text-xs text-muted-foreground">
                    Alterna entre tema claro y oscuro
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

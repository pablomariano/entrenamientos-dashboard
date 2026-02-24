"use client";

import { PlusCircleIcon, type LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavMain({
  items,
  quickAction,
}: {
  items: {
    title: string;
    url: string;
    icon?: LucideIcon;
  }[];
  quickAction?: {
    title: string;
    url: string;
    icon: LucideIcon;
    tooltip?: string;
  };
}) {
  const pathname = usePathname();
  const action = quickAction ?? {
    title: "Quick Create",
    url: "#",
    icon: PlusCircleIcon,
    tooltip: "Quick Create",
  };

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              asChild={!!quickAction}
              tooltip={action.tooltip ?? action.title}
              className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
            >
              {quickAction ? (
                <a href={action.url}>
                  <action.icon />
                  <span>{action.title}</span>
                </a>
              ) : (
                <>
                  <action.icon />
                  <span>{action.title}</span>
                </>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = pathname === item.url || (item.url !== "/dashboard" && pathname?.startsWith(item.url));
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
                  <a href={item.url}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

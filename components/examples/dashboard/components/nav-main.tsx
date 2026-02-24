"use client";

import * as React from "react";
import Link from "next/link";
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
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
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
                <Link href={action.url}>
                  <action.icon />
                  <span>{action.title}</span>
                </Link>
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
            const isActive = mounted && pathname === item.url;
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
                  <Link href={item.url}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Activity } from "lucide-react";

export function EntrenamientosSiteHeader() {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4" />
        <span className="text-sm font-medium">Dashboard de Entrenamientos</span>
      </div>
    </header>
  );
}

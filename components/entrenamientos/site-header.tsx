"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Activity, Save } from "lucide-react";
import { useTrainingData } from "@/lib/entrenamientos/training-data-context";

export function EntrenamientosSiteHeader() {
  const { data, loading, saving, save } = useTrainingData();

  return (
    <header className="sticky top-0 z-50 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex flex-1 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          <span className="text-sm font-medium">Dashboard de Entrenamientos</span>
        </div>
        {!loading && data && (
          <Button
            variant="outline"
            size="sm"
            onClick={save}
            disabled={saving}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        )}
      </div>
    </header>
  );
}

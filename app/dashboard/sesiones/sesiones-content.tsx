"use client";

import { useTrainingData } from "@/lib/entrenamientos/training-data-context";
import { SessionsList } from "@/components/entrenamientos/sessions-list";

export function SesionesContent() {
  const { data, loading } = useTrainingData();

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="flex w-full flex-col justify-start gap-6">
            <div className="flex flex-1 items-center justify-center py-20">
              <div className="text-lg text-muted-foreground">Cargando sesiones desde la base de datos...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="flex w-full flex-col justify-start gap-6">
            <SessionsList sessions={data.sessions} />
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTrainingData } from "@/lib/entrenamientos/training-data-context";
import { decodeSessionId } from "@/lib/entrenamientos/session-utils";
import { ExerciseMinutes } from "@/components/entrenamientos/charts/exercise-minutes";
import { HREvolutionChart } from "@/components/entrenamientos/charts/hr-evolution-chart";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data, loading } = useTrainingData();
  const sessionId = params.sessionId as string;
  const startTime = decodeSessionId(sessionId);
  const session = data?.sessions.find((s) => s.start_time === startTime);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="text-lg text-muted-foreground">Cargando sesión...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20 px-4">
        <p className="text-lg text-muted-foreground text-center">
          Sesión no encontrada o datos no cargados.
        </p>
        <Button asChild variant="outline">
          <Link href="/dashboard/sesiones">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a sesiones
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="space-y-4 px-4 lg:px-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/dashboard/sesiones">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a sesiones
          </Link>
        </Button>
        <ExerciseMinutes session={session} />
        <HREvolutionChart
          session={session}
          onClose={() => router.push("/dashboard/sesiones")}
        />
      </div>
    </div>
  );
}

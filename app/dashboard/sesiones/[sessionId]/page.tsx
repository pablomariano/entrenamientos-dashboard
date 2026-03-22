"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTrainingData } from "@/lib/entrenamientos/training-data-context";
import { decodeSessionId } from "@/lib/entrenamientos/session-utils";
import { processTrainingData } from "@/lib/entrenamientos/data-processor";
import { ExerciseMinutes } from "@/components/entrenamientos/charts/exercise-minutes";
import { HREvolutionChart } from "@/components/entrenamientos/charts/hr-evolution-chart";
import { SessionHeader } from "@/components/entrenamientos/session-detail/session-header";
import { TRIMPCard } from "@/components/entrenamientos/session-detail/trimp-card";
import { CardiacDriftCard } from "@/components/entrenamientos/session-detail/cardiac-drift-card";
import { LapsTable } from "@/components/entrenamientos/session-detail/laps-table";
import { AIAnalysisPanel } from "@/components/entrenamientos/session-detail/ai-analysis-panel";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data, loading } = useTrainingData();
  const sessionId = params.sessionId as string;
  const startTime = decodeSessionId(sessionId);
  const session = data?.sessions.find((s) => s.start_time === startTime);

  const globalStats = useMemo(() => {
    if (!data) return { minHR: 60, maxHR: 190 };
    const stats = processTrainingData(data);
    return {
      minHR: stats.minHR > 0 ? stats.minHR : 60,
      maxHR: stats.maxHR > 0 ? stats.maxHR : 190,
    };
  }, [data]);

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
      <div className="space-y-6 px-4 lg:px-6">
        <SessionHeader session={session} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1 flex flex-col gap-4">
            <TRIMPCard
              session={session}
              globalHRRest={globalStats.minHR}
              globalHRMax={globalStats.maxHR}
            />
            <CardiacDriftCard session={session} />
            <AIAnalysisPanel sessionId={session.id} />
          </div>
          <div className="lg:col-span-2 flex flex-col gap-4">
            <ExerciseMinutes session={session} />
            <HREvolutionChart
              session={session}
              onClose={() => router.push("/dashboard/sesiones")}
            />
            <LapsTable session={session} />
          </div>
        </div>
      </div>
    </div>
  );
}

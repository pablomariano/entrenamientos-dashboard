"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TrainingSession, formatDuration } from "@/lib/entrenamientos/data-processor";
import { ArrowLeft, Calendar, Clock, Heart, Activity } from "lucide-react";
import Link from "next/link";

interface SessionHeaderProps {
  session: TrainingSession;
}

export function SessionHeader({ session }: SessionHeaderProps) {
  const date = new Date(session.start_time);
  const dateLabel = date.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const timeLabel = date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

  const sportLabel = session.sport === "MTB" ? "MTB" : session.sport === "SPINNING" ? "Spinning" : session.sport ?? "Entrenamiento";

  return (
    <div className="space-y-3">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/dashboard/sesiones">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a sesiones
        </Link>
      </Button>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight capitalize">{session.title ?? dateLabel}</h1>
          <Badge variant="outline" className="text-xs">
            {sportLabel}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            <span className="capitalize">{dateLabel}</span> · {timeLabel}
          </span>
          <Separator orientation="vertical" className="h-4" />
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {session.duration_formatted || formatDuration(session.duration_seconds)}
          </span>
          {session.has_hr && session.hr_avg && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <span className="inline-flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5" />
                {session.hr_avg} bpm avg
              </span>
            </>
          )}
          {session.has_hr && session.hr_max && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <span className="inline-flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" />
                {session.hr_max} bpm máx
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

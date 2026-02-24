"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrainingSession } from "@/lib/entrenamientos/data-processor";
import { Heart, Clock, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const SESSIONS_PER_PAGE = 5;

interface SessionsListProps {
  sessions: TrainingSession[];
  selectedSession?: TrainingSession | null;
  onSelectSession?: (session: TrainingSession) => void;
}

export function SessionsList({ sessions, selectedSession, onSelectSession }: SessionsListProps) {
  const [page, setPage] = useState(0);
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
  );
  const totalPages = Math.ceil(sortedSessions.length / SESSIONS_PER_PAGE) || 1;
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedSessions = sortedSessions.slice(
    currentPage * SESSIONS_PER_PAGE,
    (currentPage + 1) * SESSIONS_PER_PAGE
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrenamientos Recientes</CardTitle>
        <CardDescription>
          {sortedSessions.length} sesiones · Haz clic para ver la evolución de frecuencia cardíaca
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {paginatedSessions.map((session) => {
            const date = new Date(session.start_time);
            const hasHRChart = session.has_hr && session.hr_samples && session.hr_samples.length > 0;
            const isSelected = selectedSession != null && selectedSession.start_time === session.start_time;

            return (
              <div
                key={session.start_time}
                onClick={() => onSelectSession?.(session)}
                className={cn(
                  "flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg transition-colors gap-3",
                  hasHRChart ? "cursor-pointer hover:bg-muted/60" : "cursor-default opacity-70",
                  isSelected && "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
                )}
                title={hasHRChart ? "Ver evolución de FC" : "Sin muestras de HR disponibles"}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">
                    {date.toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>{session.duration_formatted}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {session.has_hr && session.hr_avg && (
                    <Badge variant="outline" className="gap-1">
                      <Heart className="w-3 h-3" />{session.hr_avg} bpm
                    </Badge>
                  )}
                  {session.has_laps && session.num_laps && (
                    <Badge variant="outline" className="gap-1">{session.num_laps} laps</Badge>
                  )}
                  {!session.parseable && <Badge variant="destructive">Datos básicos</Badge>}
                </div>
                {hasHRChart && (
                  <ChevronRight className={cn("w-4 h-4 shrink-0 text-muted-foreground transition-transform", isSelected && "text-primary rotate-90")} />
                )}
              </div>
            );
          })}
        </div>
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {currentPage + 1} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
            >
              Siguiente
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

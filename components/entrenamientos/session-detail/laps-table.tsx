"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrainingSession, Lap, HRSample } from "@/lib/entrenamientos/data-processor";
import { Timer } from "lucide-react";

interface LapsTableProps {
  session: TrainingSession;
}

interface LapStats {
  lapNumber: number;
  startSeconds: number;
  durationSeconds: number;
  hrAvg: number | null;
  hrMax: number | null;
  hrMin: number | null;
}

function formatLapDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function computeLapStats(laps: Lap[], samples: HRSample[], totalDuration: number): LapStats[] {
  if (!laps || laps.length === 0) return [];

  // Build lap boundaries
  const boundaries: Array<{ lapNumber: number; start: number; end: number }> = [];

  if (laps[0]?.time_seconds !== undefined) {
    // time_seconds marks lap end/start boundary
    for (let i = 0; i < laps.length; i++) {
      const start = i === 0 ? 0 : (laps[i - 1].time_seconds ?? 0);
      const end = laps[i].time_seconds ?? totalDuration;
      boundaries.push({ lapNumber: i + 1, start, end });
    }
    // Last segment after last lap marker
    const lastTime = laps[laps.length - 1].time_seconds ?? 0;
    if (lastTime < totalDuration) {
      boundaries.push({ lapNumber: laps.length + 1, start: lastTime, end: totalDuration });
    }
  } else if (laps[0]?.duration_seconds !== undefined) {
    let cumulative = 0;
    for (let i = 0; i < laps.length; i++) {
      const dur = laps[i].duration_seconds ?? 0;
      boundaries.push({ lapNumber: i + 1, start: cumulative, end: cumulative + dur });
      cumulative += dur;
    }
  } else if (laps[0]?.approximate_time_seconds !== undefined) {
    for (let i = 0; i < laps.length; i++) {
      const start = i === 0 ? 0 : (laps[i - 1].approximate_time_seconds ?? 0);
      const end = laps[i].approximate_time_seconds ?? totalDuration;
      boundaries.push({ lapNumber: i + 1, start, end });
    }
    const lastTime = laps[laps.length - 1].approximate_time_seconds ?? 0;
    if (lastTime < totalDuration) {
      boundaries.push({ lapNumber: laps.length + 1, start: lastTime, end: totalDuration });
    }
  }

  return boundaries.map((b) => {
    const lapSamples = samples.filter(
      (s) => s.time_seconds >= b.start && s.time_seconds < b.end && s.hr >= 40 && s.hr <= 250
    );

    const hrValues = lapSamples.map((s) => s.hr);

    return {
      lapNumber: b.lapNumber,
      startSeconds: b.start,
      durationSeconds: b.end - b.start,
      hrAvg: hrValues.length > 0 ? Math.round(hrValues.reduce((a, v) => a + v, 0) / hrValues.length) : null,
      hrMax: hrValues.length > 0 ? Math.max(...hrValues) : null,
      hrMin: hrValues.length > 0 ? Math.min(...hrValues) : null,
    };
  });
}

export function LapsTable({ session }: LapsTableProps) {
  const laps = session.laps ?? [];
  if (laps.length === 0) return null;

  const samples = session.hr_samples ?? [];
  const lapStats = computeLapStats(laps, samples, session.duration_seconds);

  if (lapStats.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Timer className="h-4 w-4 text-primary" />
          Desglose por Vueltas ({lapStats.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto rounded-b-xl">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-16">Vuelta</TableHead>
                <TableHead className="text-right">Inicio</TableHead>
                <TableHead className="text-right">Duración</TableHead>
                <TableHead className="text-right">FC Prom</TableHead>
                <TableHead className="text-right">FC Máx</TableHead>
                <TableHead className="text-right">FC Mín</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lapStats.map((lap) => (
                <TableRow key={lap.lapNumber}>
                  <TableCell className="font-medium">L{lap.lapNumber}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatLapDuration(lap.startSeconds)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatLapDuration(lap.durationSeconds)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {lap.hrAvg ? `${lap.hrAvg} bpm` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-destructive">
                    {lap.hrMax ? `${lap.hrMax}` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {lap.hrMin ? `${lap.hrMin}` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

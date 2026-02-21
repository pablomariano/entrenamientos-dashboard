"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { TrainingSession, Lap } from "@/lib/entrenamientos/data-processor";

interface HREvolutionChartProps {
  session: TrainingSession;
  onClose: () => void;
}

interface LapSeparator {
  time_seconds: number;
  lap_number: number;
}

function getLapSeparators(laps: Lap[]): LapSeparator[] {
  if (!laps || laps.length === 0) return [];
  if (laps[0]?.time_seconds !== undefined) {
    return laps
      .filter((lap) => (lap.time_seconds ?? 0) > 0)
      .map((lap) => ({ time_seconds: lap.time_seconds!, lap_number: lap.lap_number }));
  }
  if (laps[0]?.duration_seconds !== undefined) {
    const separators: LapSeparator[] = [];
    let cumulative = 0;
    for (let i = 0; i < laps.length - 1; i++) {
      cumulative += laps[i].duration_seconds!;
      if (cumulative > 0) separators.push({ time_seconds: cumulative, lap_number: i + 1 });
    }
    return separators;
  }
  if (laps[0]?.approximate_time_seconds !== undefined) {
    return laps
      .filter((lap) => (lap.approximate_time_seconds ?? 0) > 0)
      .map((lap) => ({ time_seconds: lap.approximate_time_seconds!, lap_number: lap.lap_number }));
  }
  return [];
}

function LapMarkerLabel(props: {
  viewBox?: { x: number; y: number; width: number; height: number };
  lapNumber: number;
}) {
  const { viewBox, lapNumber } = props;
  if (!viewBox) return null;
  const { x, y } = viewBox;
  const w = 38;
  const h = 19;
  return (
    <g>
      <polygon points={`${x},${y + h + 5} ${x - 5},${y + h - 1} ${x + 5},${y + h - 1}`} fill="#4f46e5" opacity={0.9} />
      <rect x={x - w / 2} y={y + 4} width={w} height={h} rx={4} fill="#4f46e5" opacity={0.9} />
      <text x={x} y={y + 4 + h / 2 + 4} textAnchor="middle" fontSize={10} fontWeight="bold" fill="white">
        Lap {lapNumber}
      </text>
    </g>
  );
}

const HR_MIN_VALID = 30;
const HR_MAX_VALID = 250;

export function HREvolutionChart({ session, onClose }: HREvolutionChartProps) {
  const validSamples = (session.hr_samples ?? []).filter(
    (s) => s.hr != null && s.hr >= HR_MIN_VALID && s.hr <= HR_MAX_VALID
  );

  const chartData = validSamples.map((s) => ({ time: s.time_seconds / 60, hr: s.hr }));
  const hrValues = validSamples.map((s) => s.hr);
  const minHR = hrValues.length > 0 ? Math.min(...hrValues) : 60;
  const maxHR = hrValues.length > 0 ? Math.max(...hrValues) : 180;
  const avgHR = hrValues.length > 0 ? hrValues.reduce((a, b) => a + b, 0) / hrValues.length : 0;

  const yMin = Math.max(30, Math.floor((minHR - 10) / 10) * 10);
  const yMax = Math.ceil((maxHR + 10) / 10) * 10;
  const maxTimeMins = chartData.length > 0 ? Math.max(...chartData.map((d) => d.time)) : 0;
  const xMax = Math.ceil(maxTimeMins / 5) * 5;

  const lapSeparators = getLapSeparators(session.laps ?? []);
  const date = new Date(session.start_time);
  const dateLabel = date.toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <Card className="mt-6 scroll-mt-4" id="hr-evolution-chart">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2">
              <span>Evolución de Frecuencia Cardíaca</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1 capitalize">{dateLabel}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground mt-1">
              <span>{session.duration_formatted}</span>
              {session.hr_avg && <span>Prom: <strong>{session.hr_avg} bpm</strong></span>}
              {session.hr_max && <span>Máx: <strong>{session.hr_max} bpm</strong></span>}
              {session.hr_min && <span>Mín: <strong>{session.hr_min} bpm</strong></span>}
              <span className="text-muted-foreground/60">{validSamples.length} muestras</span>
            </div>
            {lapSeparators.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {[
                  ...lapSeparators.map((lap, i) => {
                    const prevTime = i === 0 ? 0 : lapSeparators[i - 1].time_seconds;
                    return { key: `lap-${i}`, lapNumber: lap.lap_number, duration: lap.time_seconds - prevTime };
                  }),
                  ...(session.duration_seconds > lapSeparators[lapSeparators.length - 1].time_seconds
                    ? [{ key: "lap-last", lapNumber: lapSeparators.length + 1, duration: session.duration_seconds - lapSeparators[lapSeparators.length - 1].time_seconds }]
                    : []),
                ].map(({ key, lapNumber, duration }) => {
                  const h = Math.floor(duration / 3600);
                  const m = Math.floor((duration % 3600) / 60);
                  const s = duration % 60;
                  const label = h > 0
                    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
                    : `${m}:${String(s).padStart(2, "0")}`;
                  return (
                    <span key={key} className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5">
                      <span className="w-3 border-t-2 border-dashed border-primary/40 inline-block" />
                      Lap {lapNumber} — {label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0 -mt-1 -mr-2">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {chartData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Esta sesión no tiene muestras de frecuencia cardíaca disponibles.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={chartData} margin={{ top: 40, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="time"
                type="number"
                domain={[0, xMax]}
                tickCount={Math.min(12, Math.floor(xMax / (xMax <= 30 ? 2 : xMax <= 60 ? 5 : 10)) + 1)}
                tickFormatter={(v) => `${v} min`}
                fontSize={11}
                label={{ value: "Tiempo (minutos)", position: "insideBottom", offset: -12, fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                domain={[yMin, yMax]}
                tickFormatter={(v) => `${v}`}
                fontSize={11}
                label={{ value: "FC (bpm)", angle: -90, position: "insideLeft", offset: 12, fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                formatter={(value: number) => [`${value} bpm`, "FC"]}
                labelFormatter={(val: number) => {
                  const mins = Math.floor(val);
                  const secs = Math.round((val - mins) * 60);
                  return `${mins}:${String(secs).padStart(2, "0")} min`;
                }}
                contentStyle={{ fontSize: 13 }}
              />
              <ReferenceLine
                y={avgHR}
                stroke="hsl(174 72% 45%)"
                strokeDasharray="5 5"
                strokeWidth={1.5}
                label={{ value: `Prom ${Math.round(avgHR)} bpm`, position: "insideTopRight", fontSize: 11, fill: "hsl(174 72% 35%)" }}
              />
              {lapSeparators.map((lap, i) => {
                const xVal = lap.time_seconds / 60;
                if (xVal <= 0 || xVal > xMax) return null;
                const lapNum = lap.lap_number;
                return (
                  <ReferenceLine
                    key={`ref-lap-${i}`}
                    x={xVal}
                    stroke="#4f46e5"
                    strokeDasharray="6 3"
                    strokeWidth={2}
                    label={(props: { viewBox?: { x: number; y: number; width: number; height: number } }) => (
                      <LapMarkerLabel viewBox={props.viewBox} lapNumber={lapNum} />
                    )}
                  />
                );
              })}
              <Line
                type="monotone"
                dataKey="hr"
                stroke="hsl(0 84.2% 60.2%)"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, fill: "hsl(0 84.2% 60.2%)" }}
                isAnimationActive={chartData.length < 500}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

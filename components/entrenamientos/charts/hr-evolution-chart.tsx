"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, X } from "lucide-react";
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

const HR_ZONES = [
  { zone: 1, label: "Z1", min: 0, max: 100, fill: "#60a5fa", opacity: 0.15 },
  { zone: 2, label: "Z2", min: 100, max: 130, fill: "#34d399", opacity: 0.18 },
  { zone: 3, label: "Z3", min: 130, max: 155, fill: "#fbbf24", opacity: 0.2 },
  { zone: 4, label: "Z4", min: 155, max: 175, fill: "#f97316", opacity: 0.22 },
  { zone: 5, label: "Z5", min: 175, max: 999, fill: "#ef4444", opacity: 0.25 },
];

function getZoneColor(hr: number): string {
  for (const z of [...HR_ZONES].reverse()) {
    if (hr >= z.min) return z.fill;
  }
  return "var(--muted-foreground)";
}

function formatMinutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}`;
  return `0:${String(m).padStart(2, "0")}`;
}

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

  const lapSeparators = useMemo(() => getLapSeparators(session.laps ?? []), [session.laps]);
  const date = useMemo(() => new Date(session.start_time), [session.start_time]);
  const dateLabel = useMemo(
    () =>
      date.toLocaleDateString("es-ES", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      }),
    [date]
  );

  const avgColor = getZoneColor(avgHR);

  return (
    <Card className="mt-6 scroll-mt-4" id="hr-evolution-chart">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Heart className="w-4 h-4" />
              Evolución de Frecuencia Cardíaca
            </CardTitle>
            <CardDescription className="capitalize">{dateLabel}</CardDescription>
            <div className="flex flex-wrap gap-4 pt-1 text-sm">
              <div>
                <span className="text-muted-foreground">Prom </span>
                <span className="font-medium tabular-nums" style={{ color: avgColor }}>{Math.round(avgHR)}</span>
                <span className="text-muted-foreground"> bpm</span>
              </div>
              <div>
                <span className="text-muted-foreground">Máx </span>
                <span className="font-medium tabular-nums text-destructive">{maxHR}</span>
                <span className="text-muted-foreground"> bpm</span>
              </div>
              <div>
                <span className="text-muted-foreground">Mín </span>
                <span className="font-medium tabular-nums" style={{ color: HR_ZONES[0].fill }}>{minHR}</span>
                <span className="text-muted-foreground"> bpm</span>
              </div>
              <div>
                <span className="text-muted-foreground">{session.duration_formatted}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{validSamples.length} muestras</span>
              </div>
            </div>
            {lapSeparators.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  ...lapSeparators.map((lap, i) => {
                    const prevTime = i === 0 ? 0 : lapSeparators[i - 1].time_seconds;
                    return { key: `lap-${i}`, lapNumber: lap.lap_number, duration: lap.time_seconds - prevTime };
                  }),
                  ...(session.duration_seconds > lapSeparators[lapSeparators.length - 1].time_seconds
                    ? [{ key: "lap-last", lapNumber: lapSeparators.length + 1, duration: session.duration_seconds - lapSeparators[lapSeparators.length - 1].time_seconds }]
                    : []),
                ].map(({ key, lapNumber, duration }) => {
                  const m = Math.floor(duration / 60);
                  const s = duration % 60;
                  return (
                    <span key={key} className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      <span className="inline-block w-2.5 border-t border-dashed border-primary/60" />
                      L{lapNumber} {m}:{String(s).padStart(2, "0")}
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
          <>
            <ResponsiveContainer width="100%" height={380}>
            <LineChart data={chartData} margin={{ top: 40, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              {HR_ZONES.map((z) => {
                const y1 = Math.max(z.min, yMin);
                const y2 = Math.min(z.max === 999 ? yMax : z.max, yMax);
                if (y1 >= y2) return null;
                return <ReferenceArea key={z.zone} y1={y1} y2={y2} fill={z.fill} fillOpacity={z.opacity} ifOverflow="hidden" />;
              })}
              <XAxis
                dataKey="time"
                type="number"
                domain={[0, xMax]}
                tickCount={Math.min(12, Math.floor(xMax / (xMax <= 30 ? 2 : xMax <= 60 ? 5 : 10)) + 1)}
                tickFormatter={(v) => formatMinutesToTime(v)}
                fontSize={11}
                label={{ value: "Tiempo", position: "insideBottom", offset: -12, fontSize: 12, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                domain={[yMin, yMax]}
                tickFormatter={(v) => `${v}`}
                fontSize={11}
                label={{ value: "FC (bpm)", angle: -90, position: "insideLeft", offset: 12, fontSize: 12, fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                formatter={(value: number) => [`${value} bpm`, "FC"]}
                labelFormatter={(val: number) => formatMinutesToTime(val)}
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
          <div className="mt-3 flex flex-wrap justify-center gap-2.5">
            {HR_ZONES.map((z) => (
              <div 
                key={z.zone} 
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-all hover:scale-105"
                style={{ 
                  backgroundColor: `${z.fill}20`,
                  borderColor: `${z.fill}40`,
                  color: z.fill
                }}
              >
                <span 
                  className="inline-block h-2.5 w-2.5 rounded-sm ring-1 ring-white/30" 
                  style={{ backgroundColor: z.fill }} 
                />
                <span className="font-semibold">{z.label}</span>
                <span className="text-xs opacity-90">
                  {z.max === 999 ? `>${z.min}` : `${z.min}–${z.max}`}
                </span>
              </div>
            ))}
          </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

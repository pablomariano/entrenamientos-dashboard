"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Heart } from "lucide-react";
import { TrainingSession, Lap } from "@/lib/entrenamientos/data-processor";

const chartConfig = {
  hr: { label: "FC (bpm)", color: "var(--chart-1)" },
} satisfies ChartConfig;

// Zonas de FC alineadas con variables del tema
const HR_ZONES = [
  { zone: 1, label: "Z1", min: 0, max: 100, fill: "hsl(var(--chart-3))", opacity: 0.08 },
  { zone: 2, label: "Z2", min: 100, max: 130, fill: "hsl(var(--chart-2))", opacity: 0.1 },
  { zone: 3, label: "Z3", min: 130, max: 155, fill: "hsl(var(--chart-4))", opacity: 0.1 },
  { zone: 4, label: "Z4", min: 155, max: 175, fill: "hsl(var(--chart-5))", opacity: 0.12 },
  { zone: 5, label: "Z5", min: 175, max: 999, fill: "hsl(var(--chart-1))", opacity: 0.14 },
];

interface HRSessionChartProps {
  session: TrainingSession;
}

interface LapSeparator {
  time_seconds: number;
  lap_number: number;
}

const HR_MIN_VALID = 30;
const HR_MAX_VALID = 250;

function getLapSeparators(laps: Lap[]): LapSeparator[] {
  if (!laps || laps.length === 0) return [];
  if (laps[0]?.time_seconds !== undefined)
    return laps
      .filter((l) => (l.time_seconds ?? 0) > 0)
      .map((l) => ({ time_seconds: l.time_seconds!, lap_number: l.lap_number }));
  if (laps[0]?.duration_seconds !== undefined) {
    const out: LapSeparator[] = [];
    let cum = 0;
    for (let i = 0; i < laps.length - 1; i++) {
      cum += laps[i].duration_seconds!;
      if (cum > 0) out.push({ time_seconds: cum, lap_number: i + 1 });
    }
    return out;
  }
  if (laps[0]?.approximate_time_seconds !== undefined)
    return laps
      .filter((l) => (l.approximate_time_seconds ?? 0) > 0)
      .map((l) => ({ time_seconds: l.approximate_time_seconds!, lap_number: l.lap_number }));
  return [];
}

function getZoneColor(hr: number): string {
  for (const z of [...HR_ZONES].reverse()) {
    if (hr >= z.min) return z.fill;
  }
  return "hsl(var(--muted-foreground))";
}

function HRSessionTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { time: number; hr: number } }> }) {
  if (!active || !payload?.length) return null;
  const { time, hr } = payload[0].payload;
  const mins = Math.floor(time);
  const secs = Math.round((time - mins) * 60);
  const zone = HR_ZONES.findLast((z) => hr >= z.min) ?? HR_ZONES[0];
  return (
    <div className="grid min-w-[8rem] rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="text-muted-foreground font-medium">{mins}:{String(secs).padStart(2, "0")} min</div>
      <div className="font-mono font-medium tabular-nums text-foreground" style={{ color: zone.fill }}>
        {hr} bpm — {zone.label}
      </div>
    </div>
  );
}

export function HRSessionChart({ session }: HRSessionChartProps) {
  const validSamples = (session.hr_samples ?? []).filter(
    (s) => s.hr != null && s.hr >= HR_MIN_VALID && s.hr <= HR_MAX_VALID
  );

  if (validSamples.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Heart className="h-4 w-4" />
            FC por Sesión
          </CardTitle>
          <CardDescription>Evolución de la frecuencia cardíaca durante la sesión</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="py-6 text-center text-sm text-muted-foreground">Sin muestras de frecuencia cardíaca disponibles.</p>
        </CardContent>
      </Card>
    );
  }

  const hrValues = validSamples.map((s) => s.hr);
  const minHR = Math.min(...hrValues);
  const maxHR = Math.max(...hrValues);
  const avgHR = Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length);

  const chartData = validSamples.map((s) => ({ time: s.time_seconds / 60, hr: s.hr }));
  const maxTimeMins = Math.max(...chartData.map((d) => d.time));
  const xMax = Math.ceil(maxTimeMins / 5) * 5;
  const yMin = Math.max(30, Math.floor((minHR - 10) / 10) * 10);
  const yMax = Math.min(250, Math.ceil((maxHR + 10) / 10) * 10);

  const lapSeparators = getLapSeparators(session.laps ?? []);
  const avgColor = getZoneColor(avgHR);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Heart className="h-4 w-4" />
          FC por Sesión
        </CardTitle>
        <CardDescription>Evolución de la frecuencia cardíaca durante la sesión</CardDescription>
        <div className="flex gap-4 pt-1 text-sm">
          <div>
            <span className="text-muted-foreground">Prom </span>
            <span className="font-medium tabular-nums" style={{ color: avgColor }}>{avgHR}</span>
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
        </div>
        {lapSeparators.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {lapSeparators.map((lap, i) => {
              const prev = i === 0 ? 0 : lapSeparators[i - 1].time_seconds;
              const dur = lap.time_seconds - prev;
              const m = Math.floor(dur / 60);
              const s = dur % 60;
              return (
                <span key={`lap-${i}`} className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  <span className="inline-block w-2.5 border-t border-dashed border-primary/60" />
                  L{lap.lap_number} {m}:{String(s).padStart(2, "0")}
                </span>
              );
            })}
            {session.duration_seconds > lapSeparators[lapSeparators.length - 1].time_seconds && (() => {
              const prev = lapSeparators[lapSeparators.length - 1].time_seconds;
              const dur = session.duration_seconds - prev;
              const m = Math.floor(dur / 60);
              const s = dur % 60;
              const n = lapSeparators.length + 1;
              return (
                <span key="lap-last" className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  <span className="inline-block w-2.5 border-t border-dashed border-primary/60" />
                  L{n} {m}:{String(s).padStart(2, "0")}
                </span>
              );
            })()}
          </div>
        )}
      </CardHeader>
      <CardContent className="pb-2 pt-0">
        <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} />
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
              tickFormatter={(v) => `${v}m`}
              tickCount={Math.min(8, Math.floor(xMax / 5) + 1)}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              domain={[yMin, yMax]}
              tickCount={5}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip cursor={false} content={<HRSessionTooltip />} />
            <ReferenceLine y={avgHR} stroke={avgColor} strokeDasharray="4 3" strokeWidth={1} strokeOpacity={0.6} />
            {lapSeparators.map((lap, i) => {
              const xVal = lap.time_seconds / 60;
              if (xVal <= 0 || xVal > xMax) return null;
              return (
                <ReferenceLine
                  key={`ref-lap-${i}`}
                  x={xVal}
                  stroke="hsl(var(--primary))"
                  strokeDasharray="5 3"
                  strokeWidth={1.5}
                  strokeOpacity={0.7}
                />
              );
            })}
            <Line
              type="monotone"
              dataKey="hr"
              stroke="var(--color-hr)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: "var(--color-hr)" }}
              isAnimationActive={chartData.length < 500}
            />
          </ComposedChart>
        </ChartContainer>
        <div className="mt-1 flex flex-wrap justify-center gap-3">
          {HR_ZONES.map((z) => (
            <span key={z.zone} className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: z.fill }} />
              {z.label} {z.max === 999 ? `>${z.min}` : `${z.min}–${z.max}`}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

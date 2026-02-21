"use client";

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart } from "lucide-react";
import { TrainingSession, Lap } from "@/lib/entrenamientos/data-processor";

interface HRSessionChartProps {
  session: TrainingSession;
}

interface LapSeparator {
  time_seconds: number;
  lap_number: number;
}

const HR_ZONES = [
  { zone: 1, label: "Z1", min: 0, max: 100, fill: "#3b82f6", opacity: 0.07 },
  { zone: 2, label: "Z2", min: 100, max: 130, fill: "#10b981", opacity: 0.1 },
  { zone: 3, label: "Z3", min: 130, max: 155, fill: "#f59e0b", opacity: 0.1 },
  { zone: 4, label: "Z4", min: 155, max: 175, fill: "#f97316", opacity: 0.12 },
  { zone: 5, label: "Z5", min: 175, max: 999, fill: "#ef4444", opacity: 0.14 },
];

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
  return "#6b7280";
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const { time, hr } = payload[0].payload;
  const mins = Math.floor(time);
  const secs = Math.round((time - mins) * 60);
  const zone = HR_ZONES.findLast((z) => hr >= z.min) ?? HR_ZONES[0];
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground">{mins}:{String(secs).padStart(2, "0")} min</p>
      <p className="font-bold" style={{ color: zone.fill }}>{hr} bpm — {zone.label}</p>
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
            <Heart className="w-4 h-4" />
            FC por Sesión
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">Sin muestras de frecuencia cardíaca disponibles.</p>
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
          <Heart className="w-4 h-4 text-primary" />
          FC por Sesión
        </CardTitle>
        <div className="flex gap-4 text-sm pt-1">
          <div>
            <span className="text-muted-foreground">Prom </span>
            <span className="font-bold" style={{ color: avgColor }}>{avgHR}</span>
            <span className="text-muted-foreground"> bpm</span>
          </div>
          <div>
            <span className="text-muted-foreground">Máx </span>
            <span className="font-bold text-red-400">{maxHR}</span>
            <span className="text-muted-foreground"> bpm</span>
          </div>
          <div>
            <span className="text-muted-foreground">Mín </span>
            <span className="font-bold text-blue-400">{minHR}</span>
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
                <span key={`lap-${i}`} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">
                  <span className="w-2.5 border-t border-dashed border-primary/60 inline-block" />
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
                <span key="lap-last" className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">
                  <span className="w-2.5 border-t border-dashed border-primary/60 inline-block" />
                  L{n} {m}:{String(s).padStart(2, "0")}
                </span>
              );
            })()}
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0 pb-2">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
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
              fontSize={10}
              tickCount={Math.min(8, Math.floor(xMax / 5) + 1)}
              tick={{ fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[yMin, yMax]}
              fontSize={10}
              tick={{ fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              tickCount={5}
            />
            <Tooltip content={<CustomTooltip />} />
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
              stroke="hsl(0 84.2% 60.2%)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: "hsl(0 84.2% 60.2%)" }}
              isAnimationActive={chartData.length < 500}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-3 flex-wrap mt-1">
          {HR_ZONES.map((z) => (
            <span key={z.zone} className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: z.fill }} />
              {z.label} {z.max === 999 ? `>${z.min}` : `${z.min}–${z.max}`}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

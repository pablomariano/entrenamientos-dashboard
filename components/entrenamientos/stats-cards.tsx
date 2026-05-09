import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, BarChart3, Clock, Heart } from "lucide-react";
import { ProcessedStats, formatDuration } from "@/lib/entrenamientos/data-processor";

interface StatsCardsProps {
  stats: ProcessedStats;
}

interface StatCardProps {
  title: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  accentClass: string;       // bg + text for the icon circle
  barValue?: number;         // 0-100, optional progress bar
  barColorClass?: string;    // Tailwind bg class for bar
}

function StatCard({ title, value, sub, icon, accentClass, barValue, barColorClass }: StatCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${accentClass}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        <p className="text-xs text-muted-foreground">{sub}</p>
        {barValue !== undefined && barColorClass && (
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden mt-1">
            <div
              className={`h-full rounded-full ${barColorClass} transition-all duration-700`}
              style={{ width: `${Math.min(100, barValue)}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StatsCards({ stats }: StatsCardsProps) {
  const hrPct = stats.maxHR > 0
    ? Math.round(((stats.avgHR - stats.minHR) / (stats.maxHR - stats.minHR)) * 100)
    : 0;

  const hrPctSessions = stats.totalSessions > 0
    ? Math.round((stats.sessionsWithHR / stats.totalSessions) * 100)
    : 0;

  const avgHoursPerWeek = stats.totalDuration > 0
    ? Math.round((stats.totalDuration / 3600) / 17 * 10) / 10   // ~17 meses de datos
    : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 px-4 lg:px-6">
      <StatCard
        title="Total Entrenamientos"
        value={String(stats.totalSessions)}
        sub={`${stats.sessionsWithHR} con datos de FC (${hrPctSessions}%)`}
        icon={<Activity className="h-4 w-4" />}
        accentClass="bg-chart-1/15 text-chart-1"
        barValue={hrPctSessions}
        barColorClass="bg-chart-1"
      />
      <StatCard
        title="Tiempo Total"
        value={formatDuration(stats.totalDuration)}
        sub={`~${avgHoursPerWeek}h por semana en promedio`}
        icon={<Clock className="h-4 w-4" />}
        accentClass="bg-chart-2/15 text-chart-2"
        barValue={Math.min(100, avgHoursPerWeek * 10)}
        barColorClass="bg-chart-2"
      />
      <StatCard
        title="FC Promedio"
        value={`${Math.round(stats.avgHR)} bpm`}
        sub={`Máx ${stats.maxHR} · Mín ${stats.minHR} bpm`}
        icon={<Heart className="h-4 w-4" />}
        accentClass="bg-chart-4/15 text-chart-4"
        barValue={hrPct}
        barColorClass="bg-gradient-to-r from-chart-3 via-chart-4 to-chart-1"
      />
      <StatCard
        title="TRIMP Promedio"
        value={String(Math.round(stats.avgTRIMP))}
        sub="carga de entrenamiento por sesión"
        icon={<BarChart3 className="h-4 w-4" />}
        accentClass="bg-chart-5/15 text-chart-5"
        barValue={Math.min(100, (stats.avgTRIMP / 300) * 100)}
        barColorClass="bg-chart-5"
      />
    </div>
  );
}

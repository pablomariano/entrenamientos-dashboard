export interface HRSample {
  time_seconds: number;
  hr: number;
}

export interface Lap {
  lap_number: number;
  time_seconds?: number;
  duration_seconds?: number;
  approximate_time_seconds?: number;
}

export interface TrainingSession {
  id?: string;
  start_time: string;
  duration_seconds: number;
  duration_formatted: string;
  hr_avg?: number | null;
  hr_max?: number | null;
  hr_min?: number | null;
  has_hr: boolean;
  has_laps: boolean;
  has_gps?: boolean;
  num_laps?: number;
  parseable: boolean;
  hr_samples?: HRSample[];
  laps?: Lap[];
  distance?: number;
}

export interface TrainingData {
  sessions: TrainingSession[];
  total_sessions: number;
  export_date: string;
}

export interface ProcessedStats {
  totalSessions: number;
  sessionsWithHR: number;
  sessionsWithGPS: number;
  totalDuration: number;
  avgHR: number;
  maxHR: number;
  minHR: number;
  totalDistance: number;
  avgTRIMP: number;
}

export type MonthlyStats = Record<string, number>;

export function processTrainingData(data: TrainingData): ProcessedStats {
  const sessions = data.sessions;
  const sessionsWithHR = sessions.filter((s) => s.has_hr && s.hr_avg != null);
  const sessionsWithGPS = sessions.filter((s) => s.has_gps);

  const totalDuration = sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);

  const hrValues = sessionsWithHR.map((s) => s.hr_avg!).filter((v) => v > 0);
  const avgHR = hrValues.length > 0 ? hrValues.reduce((a, b) => a + b, 0) / hrValues.length : 0;
  const maxHR =
    sessionsWithHR.length > 0
      ? Math.max(...sessionsWithHR.map((s) => s.hr_max ?? 0).filter((v) => v > 0))
      : 0;
  const minHR =
    sessionsWithHR.length > 0
      ? Math.min(...sessionsWithHR.map((s) => s.hr_min ?? Infinity).filter((v) => v > 0 && v < Infinity))
      : 0;

  const totalDistance = sessionsWithGPS.reduce((sum, s) => sum + (s.distance ?? 0), 0);

  // TRIMP (Banister): TRIMP = duration_min * ΔHR * 0.64 * e^(1.92 * ΔHR)
  // ΔHR = (HRavg - HRrest) / (HRmax - HRrest)
  const HRrest = minHR > 0 ? minHR : 60;
  const HRmax = maxHR > 0 ? maxHR : 200;
  const trimpValues: number[] = [];
  for (const s of sessionsWithHR) {
    const hrAvg = s.hr_avg ?? 0;
    const hrMax = (s.hr_max ?? HRmax) > 0 ? (s.hr_max ?? HRmax) : HRmax;
    if (hrAvg <= 0 || hrMax <= HRrest) continue;
    const deltaHR = Math.max(0, Math.min(1, (hrAvg - HRrest) / (hrMax - HRrest)));
    const durationMin = (s.duration_seconds ?? 0) / 60;
    const trimp = durationMin * deltaHR * 0.64 * Math.exp(1.92 * deltaHR);
    trimpValues.push(trimp);
  }
  const avgTRIMP =
    trimpValues.length > 0 ? trimpValues.reduce((a, b) => a + b, 0) / trimpValues.length : 0;

  return {
    totalSessions: sessions.length,
    sessionsWithHR: sessionsWithHR.length,
    sessionsWithGPS: sessionsWithGPS.length,
    totalDuration,
    avgHR,
    maxHR,
    minHR,
    totalDistance,
    avgTRIMP,
  };
}

export function groupByMonth(sessions: TrainingSession[]): MonthlyStats {
  const counts: MonthlyStats = {};
  for (const s of sessions) {
    const d = new Date(s.start_time);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

export function groupDurationByMonth(sessions: TrainingSession[]): MonthlyStats {
  const durations: MonthlyStats = {};
  for (const s of sessions) {
    const d = new Date(s.start_time);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    durations[key] = (durations[key] || 0) + (s.duration_seconds || 0);
  }
  return durations;
}

export function groupTRIMPByMonth(sessions: TrainingSession[]): MonthlyStats {
  const sessionsWithHR = sessions.filter((s) => s.has_hr && s.hr_avg != null);
  const minHR =
    sessionsWithHR.length > 0
      ? Math.min(...sessionsWithHR.map((s) => s.hr_min ?? Infinity).filter((v) => v > 0 && v < Infinity))
      : 60;
  const maxHR =
    sessionsWithHR.length > 0
      ? Math.max(...sessionsWithHR.map((s) => s.hr_max ?? 0).filter((v) => v > 0))
      : 200;
  const HRrest = minHR > 0 ? minHR : 60;
  const HRmax = maxHR > 0 ? maxHR : 200;

  const trimpByMonth: MonthlyStats = {};
  for (const s of sessionsWithHR) {
    const hrAvg = s.hr_avg ?? 0;
    const hrMax = (s.hr_max ?? HRmax) > 0 ? (s.hr_max ?? HRmax) : HRmax;
    if (hrAvg <= 0 || hrMax <= HRrest) continue;
    const deltaHR = Math.max(0, Math.min(1, (hrAvg - HRrest) / (hrMax - HRrest)));
    const durationMin = (s.duration_seconds ?? 0) / 60;
    const trimp = durationMin * deltaHR * 0.64 * Math.exp(1.92 * deltaHR);

    const d = new Date(s.start_time);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    trimpByMonth[key] = (trimpByMonth[key] || 0) + trimp;
  }
  return trimpByMonth;
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const HR_ZONES = [
  { zone: 1, label: "Z1", min: 0, max: 100 },
  { zone: 2, label: "Z2", min: 100, max: 130 },
  { zone: 3, label: "Z3", min: 130, max: 155 },
  { zone: 4, label: "Z4", min: 155, max: 175 },
  { zone: 5, label: "Z5", min: 175, max: 999 },
];

const HR_MIN_VALID = 30;
const HR_MAX_VALID = 250;

export interface ZoneHours {
  zone: number;
  label: string;
  hours: number;
  seconds: number;
}

export function getHoursByZone(sessions: TrainingSession[]): ZoneHours[] {
  const zoneSecs = new Array(HR_ZONES.length).fill(0) as number[];

  for (const session of sessions) {
    const samples = (session.hr_samples ?? []).filter(
      (s) => s.hr != null && s.hr >= HR_MIN_VALID && s.hr <= HR_MAX_VALID
    );
    for (let i = 0; i < samples.length; i++) {
      const hr = samples[i].hr;
      const interval =
        i < samples.length - 1
          ? samples[i + 1].time_seconds - samples[i].time_seconds
          : i > 0
            ? samples[i].time_seconds - samples[i - 1].time_seconds
            : 5;
      const zoneIdx = HR_ZONES.findIndex((z) => hr >= z.min && hr < z.max);
      if (zoneIdx >= 0) zoneSecs[zoneIdx] += interval;
    }
  }

  return HR_ZONES.map((z, i) => ({
    zone: z.zone,
    label: z.label,
    seconds: zoneSecs[i],
    hours: Math.round((zoneSecs[i] / 3600) * 100) / 100,
  }));
}

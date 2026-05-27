"use client";

import * as React from "react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useTrainingData } from "@/lib/entrenamientos/training-data-context";
import Link from "next/link";
import { encodeSessionId } from "@/lib/entrenamientos/session-utils";
import { cn } from "@/lib/utils";
import {
  Plus,
  Sparkles,
  Loader2,
  Trash2,
  CheckCircle2,
  Circle,
  Bike,
  Dumbbell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Heart,
  Activity,
} from "lucide-react";

interface ScheduledTraining {
  id: string;
  date: string;
  sport: "MTB" | "SPINNING";
  durationPlanned: number | null;
  notes: string | null;
  completed: boolean;
  linkedSessionId: string | null;
  linkedSession?: { id: string; title: string; sport: string; hrAvg: number | null; trimp: number | null } | null;
}

interface AISuggestion {
  rationale: string;
  suggestions: Array<{
    date: string;
    sport: "MTB" | "SPINNING";
    durationPlanned: number;
    notes: string;
  }>;
}

export function CalendarioContent() {
  const { data } = useTrainingData();
  const [month, setMonth] = React.useState(new Date());
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());
  const [trainings, setTrainings] = React.useState<ScheduledTraining[]>([]);
  const [loadingTrainings, setLoadingTrainings] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingTraining, setEditingTraining] = React.useState<ScheduledTraining | null>(null);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiSuggestion, setAiSuggestion] = React.useState<AISuggestion | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Form state
  const [formSport, setFormSport] = React.useState<"MTB" | "SPINNING">("SPINNING");
  const [formDuration, setFormDuration] = React.useState("45");
  const [formNotes, setFormNotes] = React.useState("");

  const fetchTrainings = React.useCallback(async () => {
    setLoadingTrainings(true);
    try {
      const from = startOfMonth(month).toISOString();
      const to = endOfMonth(month).toISOString();
      const res = await fetch(`/api/schedule?from=${from}&to=${to}`);
      if (res.ok) {
        const data = await res.json();
        setTrainings(data);
      }
    } catch (err) {
      console.error("Error fetching trainings:", err);
    } finally {
      setLoadingTrainings(false);
    }
  }, [month]);

  React.useEffect(() => {
    fetchTrainings();
  }, [fetchTrainings]);

  // Get sessions from training data that fall in this month
  const sessionsThisMonth = React.useMemo(() => {
    if (!data?.sessions) return [];
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    return data.sessions.filter((s) => {
      const d = new Date(s.start_time);
      return d >= monthStart && d <= monthEnd;
    });
  }, [data, month]);

  // Dates with events (for calendar highlighting)
  const scheduledDates = React.useMemo(
    () => trainings.map((t) => new Date(t.date)),
    [trainings]
  );
  const sessionDates = React.useMemo(
    () => sessionsThisMonth.map((s) => new Date(s.start_time)),
    [sessionsThisMonth]
  );

  // Trainings and sessions for selected date
  const selectedTrainings = React.useMemo(() => {
    if (!selectedDate) return [];
    return trainings.filter((t) => isSameDay(new Date(t.date), selectedDate));
  }, [trainings, selectedDate]);

  const selectedSessions = React.useMemo(() => {
    if (!selectedDate) return [];
    return sessionsThisMonth.filter((s) => isSameDay(new Date(s.start_time), selectedDate));
  }, [sessionsThisMonth, selectedDate]);

  const openNewDialog = () => {
    setEditingTraining(null);
    setFormSport("SPINNING");
    setFormDuration("45");
    setFormNotes("");
    setDialogOpen(true);
  };

  const openEditDialog = (training: ScheduledTraining) => {
    setEditingTraining(training);
    setFormSport(training.sport);
    setFormDuration(training.durationPlanned?.toString() ?? "");
    setFormNotes(training.notes ?? "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedDate) return;
    setSaving(true);
    try {
      const body = {
        date: selectedDate.toISOString(),
        sport: formSport,
        durationPlanned: formDuration ? parseInt(formDuration, 10) : undefined,
        notes: formNotes || undefined,
      };

      if (editingTraining) {
        await fetch(`/api/schedule/${editingTraining.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        await fetch("/api/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      setDialogOpen(false);
      fetchTrainings();
    } catch (err) {
      console.error("Error saving:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/schedule/${id}`, { method: "DELETE" });
      fetchTrainings();
    } catch (err) {
      console.error("Error deleting:", err);
    }
  };

  const handleToggleComplete = async (training: ScheduledTraining) => {
    try {
      await fetch(`/api/schedule/${training.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !training.completed }),
      });
      fetchTrainings();
    } catch (err) {
      console.error("Error toggling:", err);
    }
  };

  const handleAISuggest = async () => {
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const weekStart = selectedDate ?? new Date();
      const res = await fetch("/api/ai/suggest-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStartDate: format(weekStart, "yyyy-MM-dd") }),
      });
      if (res.ok) {
        const data: AISuggestion = await res.json();
        setAiSuggestion(data);
      }
    } catch (err) {
      console.error("Error AI suggest:", err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplySuggestion = async (suggestion: AISuggestion["suggestions"][number]) => {
    try {
      await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: new Date(suggestion.date).toISOString(),
          sport: suggestion.sport,
          durationPlanned: suggestion.durationPlanned,
          notes: suggestion.notes,
        }),
      });
      fetchTrainings();
    } catch (err) {
      console.error("Error applying suggestion:", err);
    }
  };

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Calendario</h2>
            <p className="text-sm text-muted-foreground">
              Planifica y agenda tus entrenamientos
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleAISuggest} disabled={aiLoading}>
              {aiLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Sugerir plan IA
            </Button>
            <Button size="sm" onClick={openNewDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Agendar
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-3 lg:px-6">
        {/* Calendar */}
        <Card className="lg:col-span-1 overflow-hidden border-muted/60 shadow-sm bg-card/30">
          <div className="flex items-center justify-between px-4 py-3 border-b border-muted/50 bg-muted/20">
            <span className="text-sm font-semibold capitalize text-foreground flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              {format(month, "MMMM yyyy", { locale: es })}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7 hover:bg-muted" onClick={() => setMonth(subMonths(month, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7 hover:bg-muted" onClick={() => setMonth(addMonths(month, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardContent className="p-3">
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                month={month}
                onMonthChange={setMonth}
                modifiers={{
                  scheduled: scheduledDates,
                  session: sessionDates,
                }}
                modifiersClassNames={{
                  scheduled: "border border-dashed border-primary/60 bg-primary/5 text-primary rounded-lg font-medium",
                  session: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 dark:bg-emerald-500/20 border border-emerald-500/20 rounded-lg font-semibold",
                }}
                classNames={{
                  month_caption: "hidden",
                  nav: "hidden",
                  months: "w-full flex flex-col sm:flex-row space-y-4 sm:space-y-0 relative gap-2 capitalize",
                  month: "space-y-4 w-full",
                  month_grid: "w-full border-collapse space-y-1",
                  weekdays: "flex w-full justify-between",
                  weekday: "w-full text-center text-muted-foreground rounded-md font-normal text-[0.8rem] flex-1",
                  week: "flex w-full mt-2 justify-between",
                  day: "h-9 w-full p-0 font-normal aria-selected:opacity-100 rounded-none flex justify-center items-center flex-1",
                  day_button: cn(
                    "h-9 w-full text-center text-sm p-0 relative focus-within:relative focus-within:z-20 rounded-md flex items-center justify-center transition-colors",
                    "hover:bg-muted"
                  ),
                  selected: "!bg-primary !text-primary-foreground hover:!bg-primary hover:!text-primary-foreground focus:!bg-primary focus:!text-primary-foreground z-10",
                  day_selected: "!bg-primary !text-primary-foreground hover:!bg-primary hover:!text-primary-foreground focus:!bg-primary focus:!text-primary-foreground z-10",
                  today: "bg-accent text-accent-foreground font-semibold",
                  day_today: "bg-accent text-accent-foreground font-semibold",
                }}
                locale={es}
                className="p-1 w-full"
              />
            </div>
            <Separator className="my-3 opacity-60" />
            <div className="flex flex-wrap items-center gap-4 px-2 py-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 font-medium hover:text-foreground transition-colors cursor-default">
                <span className="h-3 w-3 rounded border border-dashed border-primary/60 bg-primary/5 shrink-0" />
                Agendado
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium hover:text-foreground transition-colors cursor-default">
                <span className="h-3 w-3 rounded border border-emerald-500/20 bg-emerald-500/15 dark:bg-emerald-500/20 shrink-0" />
                Sesión realizada
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Day detail */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-primary" />
              {selectedDate ? (
                <span className="capitalize">{format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}</span>
              ) : (
                "Selecciona un día"
              )}
            </CardTitle>
            <CardDescription>
              {selectedTrainings.length} agendados · {selectedSessions.length} sesiones realizadas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Scheduled trainings */}
            {selectedTrainings.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Agendados</h4>
                {selectedTrainings.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-lg border p-3 group">
                    <button onClick={() => handleToggleComplete(t)} className="shrink-0">
                      {t.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-chart-2" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {t.sport === "MTB" ? <Bike className="h-3.5 w-3.5" /> : <Dumbbell className="h-3.5 w-3.5" />}
                        <span className={`text-sm font-medium ${t.completed ? "line-through text-muted-foreground" : ""}`}>
                          {t.sport}
                        </span>
                        {t.durationPlanned && (
                          <Badge variant="secondary" className="text-xs">{t.durationPlanned} min</Badge>
                        )}
                        {t.completed && <Badge variant="outline" className="text-xs text-chart-2">Completado</Badge>}
                      </div>
                      {t.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(t)}>
                        <CalendarDays className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(t.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Completed sessions */}
            {selectedSessions.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sesiones realizadas</h4>
                {selectedSessions.map((s) => {
                  const time = new Date(s.start_time).toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "UTC",
                  });
                  const hasDetails = s.has_hr && s.hr_samples && s.hr_samples.length > 0;
                  const sessionUrl = `/dashboard/sesiones/${encodeSessionId(s.start_time)}`;
                  
                  const sportLabel = s.sport === "MTB" ? "MTB" : s.sport === "SPINNING" ? "Spinning" : s.sport ?? "Entrenamiento";
                  
                  const cardContent = (
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-chart-2/10 text-chart-2">
                        {s.sport === "MTB" ? (
                          <Bike className="h-4.5 w-4.5" />
                        ) : s.sport === "SPINNING" ? (
                          <Dumbbell className="h-4.5 w-4.5" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {s.title ?? `${sportLabel} del ${format(new Date(s.start_time), "d 'de' MMM", { locale: es })}`}
                          </span>
                          {s.title && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal uppercase">
                              {sportLabel}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs font-mono">{s.duration_formatted}</Badge>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {time}
                          </span>
                          
                          {s.hr_avg && (
                            <span className="flex items-center gap-1 text-red-500/80 dark:text-red-400/80">
                              <Heart className="h-3 w-3 fill-current" />
                              FC Prom: {s.hr_avg} bpm
                            </span>
                          )}
                          
                          {s.hr_max && (
                            <span className="flex items-center gap-1">
                              <Activity className="h-3 w-3" />
                              FC Máx: {s.hr_max} bpm
                            </span>
                          )}

                          {s.distance && (
                            <span className="flex items-center gap-1 font-medium text-chart-5">
                              {s.distance.toFixed(1)} km
                            </span>
                          )}

                          {s.has_laps && s.num_laps && (
                            <span className="flex items-center gap-1">
                              {s.num_laps} {s.num_laps === 1 ? "vuelta" : "vueltas"}
                            </span>
                          )}
                        </div>

                        {s.notes && (
                          <p className="text-xs text-muted-foreground mt-1.5 italic line-clamp-2 bg-muted/20 p-1.5 rounded border border-dashed">
                            {s.notes}
                          </p>
                        )}
                      </div>
                      
                      {hasDetails && (
                        <div className="shrink-0 self-center text-muted-foreground group-hover:text-primary transition-colors">
                          <ChevronRight className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                  );

                  return hasDetails ? (
                    <Link
                      key={s.start_time}
                      href={sessionUrl}
                      className="block rounded-lg border bg-card hover:bg-muted/40 hover:border-primary/30 p-3.5 transition-all group shadow-sm cursor-pointer"
                    >
                      {cardContent}
                    </Link>
                  ) : (
                    <div
                      key={s.start_time}
                      className="rounded-lg border bg-muted/10 p-3.5 shadow-sm"
                    >
                      {cardContent}
                    </div>
                  );
                })}
              </div>
            )}

            {selectedTrainings.length === 0 && selectedSessions.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Sin actividad para este día</p>
                <Button variant="outline" size="sm" onClick={openNewDialog}>
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Agendar entrenamiento
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Suggestion panel */}
      {aiSuggestion && (
        <div className="px-4 lg:px-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Plan sugerido por IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{aiSuggestion.rationale}</p>
              <Separator />
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {aiSuggestion.suggestions.map((s, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        {s.sport === "MTB" ? <Bike className="h-3.5 w-3.5" /> : <Dumbbell className="h-3.5 w-3.5" />}
                        <span className="text-sm font-medium capitalize">
                          {format(new Date(s.date), "EEEE d", { locale: es })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{s.notes}</p>
                      <Badge variant="secondary" className="text-xs">{s.durationPlanned} min</Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleApplySuggestion(s)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTraining ? "Editar entrenamiento" : "Agendar entrenamiento"}</DialogTitle>
            <DialogDescription>
              {selectedDate ? format(selectedDate, "EEEE d 'de' MMMM yyyy", { locale: es }) : "Selecciona una fecha"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="sport">Deporte</Label>
              <Select value={formSport} onValueChange={(v) => setFormSport(v as "MTB" | "SPINNING")}>
                <SelectTrigger id="sport">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MTB">
                    <span className="inline-flex items-center gap-2"><Bike className="h-3.5 w-3.5" /> MTB</span>
                  </SelectItem>
                  <SelectItem value="SPINNING">
                    <span className="inline-flex items-center gap-2"><Dumbbell className="h-3.5 w-3.5" /> Spinning</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="duration">Duración planificada (minutos)</Label>
              <Input
                id="duration"
                type="number"
                value={formDuration}
                onChange={(e) => setFormDuration(e.target.value)}
                placeholder="45"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notas</Label>
              <Input
                id="notes"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Sesión de recuperación activa..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingTraining ? "Guardar cambios" : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

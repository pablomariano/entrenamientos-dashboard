"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { TrainingSession } from "@/lib/entrenamientos/data-processor";
import { emitTrainingDataRefetch } from "@/lib/entrenamientos/training-data-context";
import { encodeSessionId } from "@/lib/entrenamientos/session-utils";
import { DateRangePicker, type DateRangeFilter } from "@/components/entrenamientos/date-range-picker";
import {
  GripVertical,
  Columns3,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Heart,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionsListProps {
  sessions: TrainingSession[];
}

const COLUMN_IDS = ["header", "target", "limit", "hr_max", "hr_min", "reviewer"] as const;
type ColumnId = (typeof COLUMN_IDS)[number];

type SortKey = "duration" | "hr_avg" | "hr_max" | "hr_min" | null;
type SortDir = "asc" | "desc";

type FilterType = "all" | "withHR" | "withLaps";

const PAGE_SIZES = [10, 20, 30, 40, 50];

function DragHandle({
  attributes,
  listeners,
}: {
  attributes: React.HTMLAttributes<HTMLElement>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listeners: Record<string, any> | undefined;
}) {
  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="size-7 shrink-0 cursor-grab text-muted-foreground hover:bg-transparent active:cursor-grabbing"
    >
      <GripVertical className="size-3.5" />
      <span className="sr-only">Arrastrar para reordenar</span>
    </Button>
  );
}

function SortableHeader({
  label,
  sortKey: key,
  currentSortKey,
  sortDir,
  onSort,
}: {
  label: string;
  sortKey: NonNullable<SortKey>;
  currentSortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: NonNullable<SortKey>) => void;
}) {
  const isActive = currentSortKey === key;
  return (
    <button
      className="inline-flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors"
      onClick={() => onSort(key)}
    >
      {label}
      {isActive ? (
        sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
      ) : (
        <ArrowUpDown className="size-3 opacity-40" />
      )}
    </button>
  );
}

function SortableSessionRow({
  session,
  columnVisibility,
  onRename,
  onDelete,
  selected,
  canSelect,
  onToggleSelect,
}: {
  session: TrainingSession;
  columnVisibility: Record<string, boolean>;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  selected: boolean;
  canSelect: boolean;
  onToggleSelect: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const date = new Date(session.start_time);
  const hasHRChart = session.has_hr && session.hr_samples && session.hr_samples.length > 0;
  const sessionUrl = `/dashboard/sesiones/${encodeSessionId(session.start_time)}`;

  const { transform, transition, setNodeRef, isDragging, attributes, listeners } = useSortable({
    id: session.start_time,
  });

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

  async function handleRenameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session.id || !editTitle.trim()) return;
    setIsSaving(true);
    try {
      await onRename(session.id, editTitle.trim());
      setEditOpen(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!session.id) return;
    setIsSaving(true);
    try {
      await onDelete(session.id);
      setDeleteOpen(false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <TableRow
      ref={setNodeRef}
      data-state={selected ? "selected" : undefined}
      className={cn(
        "group relative transition-colors",
        isDragging && "z-10 opacity-80",
        selected && "bg-muted/40",
        hasHRChart && "cursor-pointer hover:bg-muted/60"
      )}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <TableCell className="w-[4.75rem] px-1.5">
        <div className="flex items-center gap-1">
          <DragHandle attributes={attributes} listeners={listeners} />
          <Checkbox
            checked={selected}
            disabled={!canSelect}
            onCheckedChange={() => canSelect && onToggleSelect()}
            onClick={(e) => e.stopPropagation()}
            aria-label={canSelect ? `Seleccionar sesión` : "Sesión no eliminable"}
            title={canSelect ? undefined : "Sin identificador en base de datos"}
            className="shrink-0"
          />
        </div>
      </TableCell>
      {columnVisibility.header !== false && (
        <TableCell className="min-w-[200px]">
          <Link
            href={sessionUrl}
            className={cn(
              "font-medium text-foreground hover:underline",
              !hasHRChart && "pointer-events-none text-muted-foreground"
            )}
            title={hasHRChart ? "Ver detalle de sesión" : "Sin datos de FC"}
          >
            {session.title ?? dateLabel}
          </Link>
          <div className="text-xs text-muted-foreground">
            {session.title ? `${dateLabel} · ${timeLabel}` : timeLabel}
          </div>
        </TableCell>
      )}
      {columnVisibility.target !== false && (
        <TableCell className="text-right">
          <span className="inline-flex items-center gap-1 text-sm">
            <Clock className="size-3.5" />
            {session.duration_formatted}
          </span>
        </TableCell>
      )}
      {columnVisibility.limit !== false && (
        <TableCell className="text-right">
          {session.has_hr && session.hr_avg ? (
            <span className="inline-flex items-center gap-1 text-sm">
              <Heart className="size-3.5" />
              {session.hr_avg} bpm
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
      )}
      {columnVisibility.hr_max !== false && (
        <TableCell className="text-right">
          {session.has_hr && session.hr_max ? (
            <span className="inline-flex items-center gap-1 text-sm">
              <Heart className="size-3.5 text-red-500" />
              {session.hr_max} bpm
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
      )}
      {columnVisibility.hr_min !== false && (
        <TableCell className="text-right">
          {session.has_hr && session.hr_min ? (
            <span className="inline-flex items-center gap-1 text-sm">
              <Heart className="size-3.5 text-blue-400" />
              {session.hr_min} bpm
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
      )}
      {columnVisibility.reviewer !== false && (
        <TableCell>
          {session.has_laps && session.num_laps ? (
            <span className="text-sm">{session.num_laps} vueltas</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
      )}
      <TableCell className="w-12 px-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreVertical className="size-4" />
              <span className="sr-only">Acciones</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => { setEditTitle(session.title ?? ""); setEditOpen(true); }}>
              <Pencil className="size-4 mr-2" />
              Editar nombre
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4 mr-2" />
              Eliminar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar nombre de sesión</DialogTitle>
              <DialogDescription>{dateLabel} · {timeLabel}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRenameSubmit}>
              <div className="py-4">
                <Label htmlFor={`edit-title-${session.start_time}`}>Nombre</Label>
                <Input
                  id={`edit-title-${session.start_time}`}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Nombre de la sesión..."
                  className="mt-2"
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving || !editTitle.trim()}>
                  {isSaving ? "Guardando..." : "Guardar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Eliminar sesión</DialogTitle>
              <DialogDescription>
                ¿Estás seguro? Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground py-1">
              {session.title ? `${session.title} · ` : ""}{dateLabel} · {timeLabel}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isSaving}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isSaving}>
                {isSaving ? "Eliminando..." : "Eliminar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TableCell>
    </TableRow>
  );
}

function isSessionInDateRange(
  session: TrainingSession,
  range: DateRangeFilter | undefined
): boolean {
  if (!range?.from) return true;
  const sessionDate = new Date(session.start_time);
  const sessionDay = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
  const fromDay = new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate());
  if (sessionDay < fromDay) return false;
  if (!range.to) return true;
  const toDay = new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate());
  return sessionDay <= toDay;
}

function isDeleteSuccessful(res: Response): boolean {
  return res.ok || res.status === 404;
}

export function SessionsList({ sessions }: SessionsListProps) {
  const [orderedSessions, setOrderedSessions] = useState<TrainingSession[]>(() =>
    [...sessions].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
  );

  useEffect(() => {
    setOrderedSessions(
      [...sessions].sort(
        (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      )
    );
  }, [sessions]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    header: true,
    target: true,
    limit: true,
    hr_max: true,
    hr_min: true,
    reviewer: true,
  });
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [dateRange, setDateRange] = useState<DateRangeFilter | undefined>(undefined);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Cargar preferencias desde localStorage al montar
  useEffect(() => {
    try {
      const savedFilterType = localStorage.getItem("sessions-filterType");
      if (savedFilterType) setFilterType(savedFilterType as FilterType);

      const savedSortKey = localStorage.getItem("sessions-sortKey");
      if (savedSortKey) {
        setSortKey(savedSortKey === "null" ? null : (savedSortKey as SortKey));
      }

      const savedSortDir = localStorage.getItem("sessions-sortDir");
      if (savedSortDir) setSortDir(savedSortDir as SortDir);

      const savedPageIndex = localStorage.getItem("sessions-pageIndex");
      if (savedPageIndex) setPageIndex(Number(savedPageIndex));

      const savedPageSize = localStorage.getItem("sessions-pageSize");
      if (savedPageSize) setPageSize(Number(savedPageSize));

      const savedColumnVisibility = localStorage.getItem("sessions-columnVisibility");
      if (savedColumnVisibility) setColumnVisibility(JSON.parse(savedColumnVisibility));

      const savedDateRange = localStorage.getItem("sessions-dateRange");
      if (savedDateRange) {
        const parsed = JSON.parse(savedDateRange);
        setDateRange({
          from: parsed.from ? new Date(parsed.from) : undefined,
          to: parsed.to ? new Date(parsed.to) : undefined,
        });
      }
    } catch (e) {
      console.error("Error al cargar las preferencias de sesiones desde localStorage:", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Guardar preferencias en localStorage cuando cambian (solo después de la carga inicial)
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem("sessions-filterType", filterType);
      localStorage.setItem("sessions-sortKey", sortKey ? sortKey : "null");
      localStorage.setItem("sessions-sortDir", sortDir);
      localStorage.setItem("sessions-pageIndex", String(pageIndex));
      localStorage.setItem("sessions-pageSize", String(pageSize));
      localStorage.setItem("sessions-columnVisibility", JSON.stringify(columnVisibility));
      
      if (dateRange) {
        localStorage.setItem("sessions-dateRange", JSON.stringify(dateRange));
      } else {
        localStorage.removeItem("sessions-dateRange");
      }
    } catch (e) {
      console.error("Error al guardar las preferencias de sesiones en localStorage:", e);
    }
  }, [filterType, sortKey, sortDir, pageIndex, pageSize, columnVisibility, dateRange, isLoaded]);

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  const filteredSessions = orderedSessions.filter((s) => {
    if (!isSessionInDateRange(s, dateRange)) return false;
    if (filterType === "withHR") return s.has_hr && s.hr_samples && s.hr_samples.length > 0;
    if (filterType === "withLaps") return s.has_laps && s.num_laps;
    return true;
  });

  const sortedFilteredSessions = sortKey
    ? [...filteredSessions].sort((a, b) => {
        let aVal: number | null | undefined;
        let bVal: number | null | undefined;
        if (sortKey === "duration") { aVal = a.duration_seconds; bVal = b.duration_seconds; }
        else if (sortKey === "hr_avg") { aVal = a.hr_avg; bVal = b.hr_avg; }
        else if (sortKey === "hr_max") { aVal = a.hr_max; bVal = b.hr_max; }
        else if (sortKey === "hr_min") { aVal = a.hr_min; bVal = b.hr_min; }
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      })
    : filteredSessions;

  const totalPages = Math.max(1, Math.ceil(sortedFilteredSessions.length / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const paginatedSessions = sortedFilteredSessions.slice(
    safePageIndex * pageSize,
    (safePageIndex + 1) * pageSize
  );

  const sessionIds: UniqueIdentifier[] = paginatedSessions.map((s) => s.start_time);

  const pageSelectableIds = useMemo(
    () => paginatedSessions.map((s) => s.id).filter(Boolean) as string[],
    [paginatedSessions]
  );
  const allPageSelected =
    pageSelectableIds.length > 0 && pageSelectableIds.every((id) => selectedIds.includes(id));
  const somePageSelected =
    pageSelectableIds.some((id) => selectedIds.includes(id)) && !allPageSelected;

  function toggleSelectId(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSelectAllOnPage() {
    if (pageSelectableIds.length === 0) return;
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageSelectableIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...pageSelectableIds])]);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      const oldIdx = orderedSessions.findIndex((s) => s.start_time === active.id);
      const newIdx = orderedSessions.findIndex((s) => s.start_time === over.id);
      if (oldIdx >= 0 && newIdx >= 0) {
        setOrderedSessions((prev) => arrayMove(prev, oldIdx, newIdx));
      }
    }
  }

  function handleSort(key: NonNullable<SortKey>) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPageIndex(0);
  }

  async function handleRename(id: string, title: string) {
    const res = await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error("Error al actualizar la sesión");
    setOrderedSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title } : s))
    );
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    if (!isDeleteSuccessful(res)) throw new Error("Error al eliminar la sesión");
    setOrderedSessions((prev) => prev.filter((s) => s.id !== id));
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    emitTrainingDataRefetch();
  }

  async function handleBulkDeleteConfirm() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    try {
      const deleted: string[] = [];
      for (const id of ids) {
        const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
        if (isDeleteSuccessful(res)) deleted.push(id);
      }
      setOrderedSessions((prev) =>
        prev.filter((s) => !s.id || !deleted.includes(s.id))
      );
      setSelectedIds((prev) => prev.filter((id) => !deleted.includes(id)));
      setBulkDeleteOpen(false);
      emitTrainingDataRefetch();
    } finally {
      setBulkDeleting(false);
    }
  }

  const withHR = orderedSessions.filter((s) => s.has_hr && s.hr_samples && s.hr_samples.length > 0).length;
  const withLaps = orderedSessions.filter((s) => s.has_laps && s.num_laps).length;

  return (
    <div className="flex w-full flex-col justify-start gap-6">
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={filterType === "all" ? "secondary" : "ghost"}
              size="sm"
              className="h-8"
              onClick={() => { setFilterType("all"); setPageIndex(0); }}
            >
              Ver resumen
            </Button>
            <Button
              variant={filterType === "withHR" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-1"
              onClick={() => { setFilterType("withHR"); setPageIndex(0); }}
            >
              Rendimiento pasado
              <Badge variant="secondary" className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1">
                {withHR}
              </Badge>
            </Button>
            <Button
              variant={filterType === "withLaps" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-1"
              onClick={() => { setFilterType("withLaps"); setPageIndex(0); }}
            >
              Con vueltas
              <Badge variant="secondary" className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1">
                {withLaps}
              </Badge>
            </Button>
            <Button variant="ghost" size="sm" className="h-8">
              Documentos
            </Button>
          </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 className="size-4" />
                <span className="hidden lg:inline">Personalizar columnas</span>
                <span className="lg:hidden">Columnas</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {COLUMN_IDS.map((colId) => (
                <DropdownMenuCheckboxItem
                  key={colId}
                  checked={columnVisibility[colId] !== false}
                  onCheckedChange={(checked) =>
                    setColumnVisibility((v) => ({ ...v, [colId]: !!checked }))
                  }
                >
                  {colId === "header" && "Sesión"}
                  {colId === "target" && "Duración"}
                  {colId === "limit" && "FC media"}
                  {colId === "hr_max" && "FC máxima"}
                  {colId === "hr_min" && "FC mínima"}
                  {colId === "reviewer" && "Vueltas"}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm">
            <Plus className="size-4" />
            <span className="hidden lg:inline">Añadir sección</span>
          </Button>
        </div>
        </div>
        <div className="flex items-center gap-4">
          <DateRangePicker
            date={dateRange}
            onDateChange={(range) => {
              setDateRange(range);
              setPageIndex(0);
            }}
          />
        </div>
      </div>

      <Card className="mx-4 lg:mx-6">
        <CardHeader className="pb-3">
          <CardTitle>Entrenamientos Recientes</CardTitle>
          <CardDescription>
            {filteredSessions.length} de {orderedSessions.length} sesiones
            {filterType !== "all" || dateRange?.from ? " (filtradas)" : ""} · Haz clic para ver la evolución de frecuencia cardíaca
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <DndContext
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={handleDragEnd}
              sensors={sensors}
            >
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-[4.75rem] px-1.5">
                      <div className="flex items-center gap-1">
                        <span className="size-7 shrink-0" aria-hidden />
                        <Checkbox
                          checked={
                            allPageSelected
                              ? true
                              : somePageSelected
                                ? "indeterminate"
                                : false
                          }
                          onCheckedChange={() => toggleSelectAllOnPage()}
                          disabled={pageSelectableIds.length === 0}
                          aria-label="Seleccionar todas las filas de esta página"
                        />
                      </div>
                    </TableHead>
                    {columnVisibility.header !== false && (
                      <TableHead>Tipo de sesión</TableHead>
                    )}
                    {columnVisibility.target !== false && (
                      <TableHead className="text-right">
                        <SortableHeader label="Duración" sortKey="duration" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      </TableHead>
                    )}
                    {columnVisibility.limit !== false && (
                      <TableHead className="text-right">
                        <SortableHeader label="FC media" sortKey="hr_avg" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      </TableHead>
                    )}
                    {columnVisibility.hr_max !== false && (
                      <TableHead className="text-right">
                        <SortableHeader label="FC máx." sortKey="hr_max" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      </TableHead>
                    )}
                    {columnVisibility.hr_min !== false && (
                      <TableHead className="text-right">
                        <SortableHeader label="FC mín." sortKey="hr_min" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      </TableHead>
                    )}
                    {columnVisibility.reviewer !== false && (
                      <TableHead>Vueltas</TableHead>
                    )}
                    <TableHead className="w-12 px-2" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <SortableContext items={sessionIds} strategy={verticalListSortingStrategy}>
                    {paginatedSessions.map((session) => (
                      <SortableSessionRow
                        key={session.start_time}
                        session={session}
                        columnVisibility={columnVisibility}
                        onRename={handleRename}
                        onDelete={handleDelete}
                        selected={!!session.id && selectedIds.includes(session.id)}
                        canSelect={!!session.id}
                        onToggleSelect={() => session.id && toggleSelectId(session.id)}
                      />
                    ))}
                  </SortableContext>
                </TableBody>
              </Table>
            </DndContext>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
            <div className="flex flex-wrap items-center gap-4">
              {selectedIds.length > 0 && (
                <>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {selectedIds.length} seleccionada{selectedIds.length === 1 ? "" : "s"}
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => setBulkDeleteOpen(true)}
                  >
                    <Trash2 className="size-4" />
                    Eliminar seleccionadas
                  </Button>
                </>
              )}
              <div className="hidden items-center gap-2 lg:flex">
                <Label htmlFor="rows-per-page" className="text-sm font-medium">
                  Filas por página
                </Label>
                <Select
                  value={`${pageSize}`}
                  onValueChange={(v) => {
                    setPageSize(Number(v));
                    setPageIndex(0);
                  }}
                >
                  <SelectTrigger className="w-20" id="rows-per-page">
                    <SelectValue placeholder={pageSize} />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {PAGE_SIZES.map((size) => (
                      <SelectItem key={size} value={`${size}`}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-muted-foreground">
                Página {safePageIndex + 1} de {totalPages}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="hidden h-8 w-8 lg:flex"
                onClick={() => setPageIndex(0)}
                disabled={safePageIndex === 0}
              >
                <span className="sr-only">Primera página</span>
                <ChevronsLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                disabled={safePageIndex === 0}
              >
                <span className="sr-only">Página anterior</span>
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePageIndex >= totalPages - 1}
              >
                <span className="sr-only">Página siguiente</span>
                <ChevronRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="hidden h-8 w-8 lg:flex"
                onClick={() => setPageIndex(totalPages - 1)}
                disabled={safePageIndex >= totalPages - 1}
              >
                <span className="sr-only">Última página</span>
                <ChevronsRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar sesiones seleccionadas</DialogTitle>
            <DialogDescription>
              Se eliminarán de forma permanente {selectedIds.length} sesión
              {selectedIds.length === 1 ? "" : "es"}. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkDeleteOpen(false)}
              disabled={bulkDeleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleBulkDeleteConfirm()}
              disabled={bulkDeleting || selectedIds.length === 0}
            >
              {bulkDeleting ? "Eliminando..." : `Eliminar ${selectedIds.length}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

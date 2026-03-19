"use client";

import { useState } from "react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { TrainingSession } from "@/lib/entrenamientos/data-processor";
import { encodeSessionId } from "@/lib/entrenamientos/session-utils";
import { DatePickerWithRange } from "@/components/examples/cards/date-picker-with-range";
import {
  GripVertical,
  Columns3,
  Plus,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Heart,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SesionesNeonViewProps {
  sessions: TrainingSession[];
}

const COLUMN_IDS = ["header", "type", "target", "limit", "reviewer"] as const;

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

function SortableRow({
  session,
  columnVisibility,
}: {
  session: TrainingSession;
  columnVisibility: Record<string, boolean>;
}) {
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

  const sport = (session as { sport?: string }).sport ?? "Entrenamiento";

  return (
    <TableRow
      ref={setNodeRef}
      className={cn(
        "group relative transition-colors",
        isDragging && "z-10 opacity-80",
        hasHRChart && "cursor-pointer hover:bg-muted/60"
      )}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <TableCell className="w-10 px-2">
        <DragHandle attributes={attributes} listeners={listeners} />
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
            {dateLabel}
          </Link>
          <div className="text-xs text-muted-foreground">{timeLabel}</div>
        </TableCell>
      )}
      {columnVisibility.type !== false && (
        <TableCell>
          <Badge variant="outline" className="text-muted-foreground">
            {!session.parseable ? "Datos básicos" : sport}
          </Badge>
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
        <Button
          variant="ghost"
          size="icon"
          className="size-8 opacity-0 group-hover:opacity-100"
          asChild
        >
          <Link href={sessionUrl} title="Ver detalle de sesión">
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

function isSessionInDateRange(
  session: TrainingSession,
  range: { from?: Date; to?: Date } | undefined
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

export function SesionesNeonView({ sessions }: SesionesNeonViewProps) {
  const [orderedSessions, setOrderedSessions] = useState<TrainingSession[]>(() =>
    [...sessions].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
  );
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    header: true,
    type: true,
    target: true,
    limit: true,
    reviewer: true,
  });
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>(undefined);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

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

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const paginatedSessions = filteredSessions.slice(
    safePageIndex * pageSize,
    (safePageIndex + 1) * pageSize
  );

  const sessionIds: UniqueIdentifier[] = paginatedSessions.map((s) => s.start_time);

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
              onClick={() => {
                setFilterType("all");
                setPageIndex(0);
              }}
            >
              View Outline
            </Button>
            <Button
              variant={filterType === "withHR" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-1"
              onClick={() => {
                setFilterType("withHR");
                setPageIndex(0);
              }}
            >
              Past Performance
              <Badge variant="secondary" className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1">
                {withHR}
              </Badge>
            </Button>
            <Button
              variant={filterType === "withLaps" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-1"
              onClick={() => {
                setFilterType("withLaps");
                setPageIndex(0);
              }}
            >
              Key Personnel
              <Badge variant="secondary" className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1">
                {withLaps}
              </Badge>
            </Button>
            <Button variant="ghost" size="sm" className="h-8">
              Focus Documents
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Columns3 className="size-4" />
                  <span className="hidden lg:inline">Customize Columns</span>
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
                    {colId === "header" && "Header"}
                    {colId === "type" && "Section Type"}
                    {colId === "target" && "Target"}
                    {colId === "limit" && "Limit"}
                    {colId === "reviewer" && "Reviewer"}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm">
              <Plus className="size-4" />
              <span className="hidden lg:inline">Add Section</span>
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <DatePickerWithRange
            inline
            date={dateRange}
            onDateChange={(range) => {
              setDateRange(range);
              setPageIndex(0);
            }}
          />
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl border bg-card mx-4 lg:mx-6">
        <div className="max-h-[min(70vh,600px)] overflow-y-auto overflow-x-auto">
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
          >
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-10 px-2" />
                  {columnVisibility.header !== false && (
                    <TableHead>Header</TableHead>
                  )}
                  {columnVisibility.type !== false && (
                    <TableHead>Section Type</TableHead>
                  )}
                  {columnVisibility.target !== false && (
                    <TableHead className="text-right">Target</TableHead>
                  )}
                  {columnVisibility.limit !== false && (
                    <TableHead className="text-right">Limit</TableHead>
                  )}
                  {columnVisibility.reviewer !== false && (
                    <TableHead>Reviewer</TableHead>
                  )}
                  <TableHead className="w-12 px-2" />
                </TableRow>
              </TableHeader>
              <TableBody>
                <SortableContext items={sessionIds} strategy={verticalListSortingStrategy}>
                  {paginatedSessions.map((session) => (
                    <SortableRow
                      key={session.start_time}
                      session={session}
                      columnVisibility={columnVisibility}
                    />
                  ))}
                </SortableContext>
              </TableBody>
            </Table>
          </DndContext>
        </div>
        <div className="flex items-center justify-between border-t px-4 py-3">
          <div className="flex items-center gap-4">
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
              Página {safePageIndex + 1} de {totalPages} · {filteredSessions.length} sesiones (Neon)
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
      </div>
    </div>
  );
}

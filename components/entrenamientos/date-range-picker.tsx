"use client";

import * as React from "react";
import { format, subDays, subMonths, startOfYear, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, Check } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DateRangeFilter {
  from?: Date;
  to?: Date;
}

interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  date?: DateRangeFilter;
  onDateChange?: (date: DateRangeFilter | undefined) => void;
}

export function DateRangePicker({
  className,
  date,
  onDateChange,
}: DateRangePickerProps) {
  const [activePreset, setActivePreset] = React.useState<string>("all");

  const presets = React.useMemo(() => [
    {
      label: "Todo el tiempo",
      value: "all",
      getValue: () => undefined,
    },
    {
      label: "Últimos 30 días",
      value: "30d",
      getValue: () => ({
        from: subDays(startOfDay(new Date()), 30),
        to: endOfDay(new Date()),
      }),
    },
    {
      label: "Últimos 3 meses",
      value: "3m",
      getValue: () => ({
        from: subMonths(startOfDay(new Date()), 3),
        to: endOfDay(new Date()),
      }),
    },
    {
      label: "Este año",
      value: "year",
      getValue: () => ({
        from: startOfYear(new Date()),
        to: endOfDay(new Date()),
      }),
    },
  ], []);

  // Update preset selection if external date changes or on mount
  React.useEffect(() => {
    if (!date || (!date.from && !date.to)) {
      setActivePreset("all");
      return;
    }

    // Check if it matches any preset (approximate to nearest minute/day)
    let matched = "custom";
    for (const preset of presets) {
      if (preset.value === "all") continue;
      const val = preset.getValue();
      if (val && date.from && date.to) {
        const fromDiff = Math.abs(val.from.getTime() - date.from.getTime());
        const toDiff = Math.abs(val.to.getTime() - date.to.getTime());
        // If within 5 minutes, consider it a match
        if (fromDiff < 300000 && toDiff < 300000) {
          matched = preset.value;
          break;
        }
      }
    }
    setActivePreset(matched);
  }, [date, presets]);

  const handlePresetSelect = (presetVal: string, getValue: () => DateRangeFilter | undefined) => {
    setActivePreset(presetVal);
    const range = getValue();
    if (onDateChange) {
      onDateChange(range);
    }
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    setActivePreset("custom");
    if (onDateChange) {
      // Ensure from is start of day and to is end of day
      const adjustedRange: DateRangeFilter | undefined = range
        ? {
            from: range.from ? startOfDay(range.from) : undefined,
            to: range.to ? endOfDay(range.to) : undefined,
          }
        : undefined;
      onDateChange(adjustedRange);
    }
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date-filter"
            variant="outline"
            size="default"
            className={cn(
              "w-full sm:w-[300px] justify-start text-left font-normal bg-background hover:bg-accent/50 transition-colors border-input/60 shadow-sm",
              !date?.from && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2.5 h-4 w-4 text-primary shrink-0 opacity-80" />
            <span className="truncate">
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "d MMM yyyy", { locale: es })} -{" "}
                    {format(date.to, "d MMM yyyy", { locale: es })}
                  </>
                ) : (
                  format(date.from, "d 'de' MMMM yyyy", { locale: es })
                )
              ) : (
                "Filtrar por fechas"
              )}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border shadow-xl rounded-xl overflow-hidden border border-border" align="end">
          {/* Presets Sidebar */}
          <div className="flex flex-row sm:flex-col gap-1 p-3 bg-muted/20 sm:w-44 shrink-0 overflow-x-auto sm:overflow-x-visible scrollbar-none">
            {presets.map((preset) => (
              <Button
                key={preset.value}
                variant="ghost"
                size="sm"
                className={cn(
                  "justify-start text-xs font-medium px-3 py-1.5 h-8 rounded-md transition-all whitespace-nowrap sm:w-full",
                  activePreset === preset.value
                    ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
                onClick={() => handlePresetSelect(preset.value, preset.getValue)}
              >
                <div className="flex items-center justify-between w-full gap-2">
                  <span>{preset.label}</span>
                  {activePreset === preset.value && (
                    <Check className="h-3.5 w-3.5 opacity-90 shrink-0" />
                  )}
                </div>
              </Button>
            ))}
          </div>

          {/* Calendar Area */}
          <div className="p-1.5 bg-background">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date as DateRange | undefined}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import * as React from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DateRangeFilter = { from?: Date; to?: Date };

interface DatePickerWithRangeProps extends React.HTMLAttributes<HTMLDivElement> {
  date?: DateRangeFilter;
  onDateChange?: (date: DateRangeFilter | undefined) => void;
  /** Si true, renderiza solo el popover (sin Card). Para uso inline. */
  inline?: boolean;
}

export function DatePickerWithRange({
  className,
  date: controlledDate,
  onDateChange,
  inline = false,
}: DatePickerWithRangeProps) {
  const [internalDate, setInternalDate] = React.useState<DateRangeFilter | undefined>(undefined);
  const date = controlledDate ?? internalDate;
  const setDate = (value: DateRange | DateRangeFilter | undefined) => {
    const handler = onDateChange ?? setInternalDate;
    handler(value as DateRangeFilter | undefined);
  };

  const content = (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id="date"
          variant="outline"
          className={cn(
            "w-full max-w-[300px] justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 size-4" />
          {date?.from ? (
            date.to ? (
              <>
                {format(date.from, "d MMM yyyy", { locale: es })} -{" "}
                {format(date.to, "d MMM yyyy", { locale: es })}
              </>
            ) : (
              format(date.from, "d MMM yyyy", { locale: es })
            )
          ) : (
            <span>Seleccionar fechas</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          defaultMonth={date?.from}
          selected={date as DateRange | undefined}
          onSelect={setDate}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );

  if (inline) {
    return <div className={cn("flex items-center", className)}>{content}</div>;
  }

  return (
    <Card className={cn("grid gap-2", className)}>
      <CardHeader>
        <CardTitle>Date picker with range</CardTitle>
        <CardDescription>Select a date range.</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

"use client";

import * as React from "react";
import { DayPicker, type DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";

import "react-day-picker/style.css";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "rdp-root p-3 text-foreground [&_.rdp-weekday]:text-muted-foreground [&_.rdp-outside]:text-muted-foreground/75 [&_.rdp-caption_label]:text-foreground [&_.rdp-button_previous]:text-foreground [&_.rdp-button_next]:text-foreground",
        className
      )}
      classNames={classNames}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar, type DateRange };

"use client";

import { ChartAreaInteractive } from "@/components/examples/dashboard/components/chart-area-interactive";
import { ChartBarMixed } from "@/components/examples/dashboard/components/chart-bar-mixed";
import { ChartPieDonut } from "@/components/examples/dashboard/components/chart-pie-donut";
import { DataTable } from "@/components/examples/dashboard/components/data-table";
import { SectionCards } from "@/components/examples/dashboard/components/section-cards";
import data from "@/components/examples/dashboard/data.json";

export default function TweakcnDashboardPage() {
  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <SectionCards />
        <div className="px-4 lg:px-6">
          <ChartAreaInteractive />
        </div>
        <DataTable data={data} />
        <div className="flex gap-4 px-4 lg:px-6">
          <div className="basis-1/2">
            <ChartPieDonut />
          </div>
          <div className="basis-1/2">
            <ChartBarMixed />
          </div>
        </div>
      </div>
    </div>
  );
}

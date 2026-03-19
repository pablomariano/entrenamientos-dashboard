"use client";

import { CardsContent } from "@/app/dashboard/cards/cards-content";
import { TweakcnContent } from "@/app/dashboard/tweakcn/tweakcn-content";

export default function EjemplosPage() {
  return (
    <div className="flex flex-col gap-6">
      <TweakcnContent />
      <CardsContent />
    </div>
  );
}

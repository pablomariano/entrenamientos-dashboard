import type { TrainingData } from "./data-processor";

const API_BASE = "/api/training-data";

export async function fetchTrainingData(): Promise<TrainingData | null> {
  const res = await fetch(API_BASE);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error("Error al cargar los datos");
  }
  return res.json() as Promise<TrainingData>;
}

export async function saveTrainingData(data: TrainingData): Promise<void> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al guardar los datos");
  }
}

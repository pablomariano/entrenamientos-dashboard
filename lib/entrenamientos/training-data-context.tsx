"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { TrainingData } from "./data-processor";
import { fetchTrainingData, saveTrainingData } from "./api";

const REFETCH_EVENT = "training-data-refetch";

/** Emitir desde fuera del provider (ej. tras importar) para forzar recarga de datos */
export function emitTrainingDataRefetch() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(REFETCH_EVENT));
  }
}

interface TrainingDataContextValue {
  data: TrainingData | null;
  loading: boolean;
  saving: boolean;
  save: () => Promise<void>;
  refetch: () => Promise<void>;
}

const TrainingDataContext = createContext<TrainingDataContextValue | null>(null);

export function TrainingDataProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState<TrainingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const parsedData = await fetchTrainingData();
      if (!parsedData) {
        router.push("/entrenamientos");
        return;
      }
      setData(parsedData);
    } catch (error) {
      console.error("Error loading data:", error);
      router.push("/entrenamientos");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const handler = () => refetch();
    window.addEventListener(REFETCH_EVENT, handler);
    return () => window.removeEventListener(REFETCH_EVENT, handler);
  }, [refetch]);

  const save = useCallback(async () => {
    if (!data) return;
    setSaving(true);
    try {
      await saveTrainingData(data);
    } catch (error) {
      console.error("Error saving:", error);
    } finally {
      setSaving(false);
    }
  }, [data]);

  const value: TrainingDataContextValue = { data, loading, saving, save, refetch };

  return (
    <TrainingDataContext.Provider value={value}>
      {children}
    </TrainingDataContext.Provider>
  );
}

export function useTrainingData() {
  const ctx = useContext(TrainingDataContext);
  if (!ctx) {
    throw new Error("useTrainingData must be used within TrainingDataProvider");
  }
  return ctx;
}

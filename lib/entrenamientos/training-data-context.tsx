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

interface TrainingDataContextValue {
  data: TrainingData | null;
  loading: boolean;
  saving: boolean;
  save: () => Promise<void>;
}

const TrainingDataContext = createContext<TrainingDataContextValue | null>(null);

export function TrainingDataProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState<TrainingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTrainingData()
      .then((parsedData) => {
        if (!parsedData) {
          router.push("/entrenamientos");
          return;
        }
        setData(parsedData);
      })
      .catch((error) => {
        console.error("Error loading data:", error);
        router.push("/entrenamientos");
      })
      .finally(() => setLoading(false));
  }, [router]);

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

  const value: TrainingDataContextValue = { data, loading, saving, save };

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

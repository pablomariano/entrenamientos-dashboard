"use client";

import * as React from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { BrainCircuit, Loader2, Sparkles, RefreshCw } from "lucide-react";

interface AIAnalysis {
  id: string;
  summary: string;
  recommendations?: string | null;
  createdAt: string;
}

interface AIAnalysisPanelProps {
  sessionId?: string;
  initialAnalyses?: AIAnalysis[];
}

export function AIAnalysisPanel({ sessionId, initialAnalyses = [] }: AIAnalysisPanelProps) {
  const [analyses, setAnalyses] = React.useState<AIAnalysis[]>(initialAnalyses);
  const [loading, setLoading] = React.useState(false);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!sessionId) { setInitialLoading(false); return; }
    fetch(`/api/sessions/${sessionId}/analyze`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: AIAnalysis[]) => setAnalyses(data))
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, [sessionId]);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [analyses]);

  const requestAnalysis = async () => {
    if (!sessionId || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/analyze`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }
      const analysis: AIAnalysis = await res.json();
      setAnalyses([analysis]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al analizar la sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BrainCircuit className="h-4 w-4 text-primary" />
          Análisis IA
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {initialLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : analyses.length === 0 && !loading && !error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
            <div className="rounded-full bg-muted p-3">
              <Sparkles className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Sin análisis aún</p>
              <p className="text-xs text-muted-foreground mt-1">
                Solicita un análisis de IA para obtener un resumen y recomendaciones personalizadas.
              </p>
            </div>
          </div>
        ) : (
          <div ref={scrollRef} className="flex flex-col gap-4 max-h-[400px] overflow-y-auto pr-1">
            {analyses.map((analysis) => (
              <div key={analysis.id} className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <Avatar className="h-7 w-7 shrink-0 border">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">IA</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <div className="rounded-lg bg-muted px-3 py-2 text-sm leading-relaxed">
                      {analysis.summary}
                    </div>
                    {analysis.recommendations && (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm leading-relaxed">
                        <p className="text-xs font-medium text-primary mb-1">Recomendaciones</p>
                        {analysis.recommendations}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(analysis.createdAt).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <Avatar className="h-7 w-7 shrink-0 border">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">IA</AvatarFallback>
                </Avatar>
                <div className="rounded-lg bg-muted px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-0">
        <Button
          className="w-full"
          variant={analyses.length > 0 ? "outline" : "default"}
          onClick={requestAnalysis}
          disabled={loading || !sessionId}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analizando...
            </>
          ) : analyses.length > 0 ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Re-analizar
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Analizar con IA
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

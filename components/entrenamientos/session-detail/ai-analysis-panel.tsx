"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BrainCircuit,
  Sparkles,
  RefreshCw,
  Lightbulb,
  ChevronRight,
  Clock,
  FileText,
} from "lucide-react";

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

/**
 * Parsea texto que puede venir como:
 * - párrafo plano
 * - "1. texto 2. texto 3. texto" (numeración inline)
 * - líneas separadas por \n con guiones/bullets
 */
function parseToItems(text: string): string[] {
  // Numeración inline: "1. ... 2. ... 3. ..."
  const numberedInline = text.split(/\s*\d+\.\s+/).filter((s) => s.trim().length > 0);
  if (numberedInline.length > 1) return numberedInline.map((s) => s.trim());

  // Líneas con bullet/guion
  const lines = text
    .split(/\n/)
    .map((l) => l.replace(/^[-•*\d+\.]\s*/, "").trim())
    .filter((l) => l.length > 0);
  if (lines.length > 1) return lines;

  return [text.trim()];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Estado vacío — card único centrado
// ---------------------------------------------------------------------------
function EmptyState({ onAnalyze, disabled }: { onAnalyze: () => void; disabled: boolean }) {
  return (
    <Card className="col-span-full">
      <CardContent className="flex flex-col items-center justify-center gap-6 py-14 text-center">
        <div className="relative flex items-center justify-center">
          <span className="absolute inline-flex h-24 w-24 animate-ping rounded-full bg-primary/8 duration-[2500ms]" />
          <span className="absolute inline-flex h-16 w-16 animate-ping rounded-full bg-primary/12 duration-[2000ms] [animation-delay:300ms]" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10 shadow-[0_0_28px_6px_hsl(var(--primary)/0.12)]">
            <BrainCircuit className="h-6 w-6 text-primary" />
          </div>
        </div>
        <div className="space-y-2 max-w-sm">
          <p className="text-base font-semibold">Sin análisis todavía</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            La IA revisará tus métricas, zonas de FC y contexto histórico para darte un resumen
            y recomendaciones personalizadas.
          </p>
        </div>
        <Button
          onClick={onAnalyze}
          disabled={disabled}
          size="lg"
          className="gap-2 px-8 shadow-[0_0_20px_2px_hsl(var(--primary)/0.2)] hover:shadow-[0_0_32px_6px_hsl(var(--primary)/0.3)] transition-all duration-300"
        >
          <Sparkles className="h-4 w-4" />
          Analizar con IA
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skeleton para dos tarjetas side-by-side
// ---------------------------------------------------------------------------
function LoadingSkeleton() {
  return (
    <>
      {/* Skeleton — Resumen */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded animate-pulse bg-muted" />
            <div className="h-4 w-20 rounded animate-pulse bg-muted" />
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-2.5">
          <div className="h-3.5 w-full animate-pulse rounded-full bg-muted" />
          <div className="h-3.5 w-[92%] animate-pulse rounded-full bg-muted" />
          <div className="h-3.5 w-[85%] animate-pulse rounded-full bg-muted" />
          <div className="h-3.5 w-[78%] animate-pulse rounded-full bg-muted" />
          <div className="h-3.5 w-[88%] animate-pulse rounded-full bg-muted" />
        </CardContent>
      </Card>

      {/* Skeleton — Recomendaciones */}
      <Card className="flex flex-col border-primary/15">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded animate-pulse bg-primary/20" />
            <div className="h-4 w-32 rounded animate-pulse bg-primary/20" />
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-4">
          {[100, 90, 95].map((w, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="h-5 w-5 shrink-0 rounded-full animate-pulse bg-primary/15" />
              <div className="flex-1 space-y-1.5">
                <div
                  className="h-3.5 animate-pulse rounded-full bg-muted"
                  style={{ width: `${w}%` }}
                />
                <div
                  className="h-3.5 animate-pulse rounded-full bg-muted"
                  style={{ width: `${w - 20}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
        {/* Dots loading */}
        <div className="flex items-center justify-center gap-2 pb-5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:120ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:240ms]" />
          <span className="ml-1 text-xs text-muted-foreground">Analizando...</span>
        </div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta de Resumen
// ---------------------------------------------------------------------------
function SummaryCard({ analysis, isNew }: { analysis: AIAnalysis; isNew: boolean }) {
  const items = parseToItems(analysis.summary);
  const isParagraph = items.length === 1;

  return (
    <Card
      className={cn(
        "flex flex-col transition-all duration-500",
        isNew && "animate-in fade-in-0 slide-in-from-bottom-4 duration-500"
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Resumen
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {isParagraph ? (
          <p className="text-sm leading-relaxed text-foreground/90">{items[0]}</p>
        ) : (
          <ul className="space-y-2.5">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                <span className="text-sm leading-relaxed text-foreground/90">{item}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta de Recomendaciones
// ---------------------------------------------------------------------------
function RecommendationsCard({ analysis, isNew }: { analysis: AIAnalysis; isNew: boolean }) {
  const items = analysis.recommendations ? parseToItems(analysis.recommendations) : [];

  if (items.length === 0) return null;

  return (
    <Card
      className={cn(
        "flex flex-col border-primary/20 bg-gradient-to-b from-primary/[0.04] to-transparent transition-all duration-500 shadow-[0_0_24px_4px_hsl(var(--primary)/0.05)]",
        isNew && "animate-in fade-in-0 slide-in-from-bottom-4 duration-700 [animation-delay:100ms]"
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Lightbulb className="h-4 w-4 text-primary" />
          Recomendaciones
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="space-y-4">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[10px] font-bold text-primary mt-0.5 leading-none">
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed text-foreground/90">{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Panel principal
// ---------------------------------------------------------------------------
export function AIAnalysisPanel({ sessionId, initialAnalyses = [] }: AIAnalysisPanelProps) {
  const [analyses, setAnalyses] = React.useState<AIAnalysis[]>(initialAnalyses);
  const [loading, setLoading] = React.useState(false);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isNew, setIsNew] = React.useState(false);

  React.useEffect(() => {
    if (!sessionId) { setInitialLoading(false); return; }
    fetch(`/api/sessions/${sessionId}/analyze`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: AIAnalysis[]) => setAnalyses(data))
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, [sessionId]);

  const requestAnalysis = async () => {
    if (!sessionId || loading) return;
    setLoading(true);
    setError(null);
    setIsNew(false);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/analyze`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }
      const analysis: AIAnalysis = await res.json();
      setAnalyses([analysis]);
      setIsNew(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al analizar la sesión");
    } finally {
      setLoading(false);
    }
  };

  const hasAnalysis = analyses.length > 0;
  const analysis = analyses[0];

  return (
    <div className="space-y-3">
      {/* ── Section header ─────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-500",
              hasAnalysis || loading
                ? "border-primary/40 bg-primary/10 shadow-[0_0_10px_2px_hsl(var(--primary)/0.2)]"
                : "border-border/60 bg-muted/50"
            )}
          >
            <BrainCircuit
              className={cn(
                "h-3 w-3 transition-colors duration-500",
                hasAnalysis || loading ? "text-primary" : "text-muted-foreground"
              )}
            />
          </div>
          <h3 className="text-sm font-semibold">Análisis IA</h3>
          {hasAnalysis && !loading && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground/60">
              DeepSeek
            </span>
          )}
        </div>

        {/* Timestamp + botón re-analizar */}
        <div className="flex items-center gap-3">
          {hasAnalysis && !loading && analysis && (
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
              <Clock className="h-3 w-3" />
              <span>{formatDate(analysis.createdAt)}</span>
            </div>
          )}
          {hasAnalysis && !loading && (
            <Button
              variant="outline"
              size="sm"
              onClick={requestAnalysis}
              disabled={loading || !sessionId}
              className="h-7 gap-1.5 px-3 text-xs"
            >
              <RefreshCw className="h-3 w-3" />
              Re-analizar
            </Button>
          )}
        </div>
      </div>

      {/* ── Grid de tarjetas ─────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {initialLoading || loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="col-span-full rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : !hasAnalysis ? (
          <EmptyState onAnalyze={requestAnalysis} disabled={!sessionId} />
        ) : (
          <>
            <SummaryCard analysis={analysis} isNew={isNew} />
            <RecommendationsCard analysis={analysis} isNew={isNew} />
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import { Upload, FileJson, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrainingData } from "@/lib/entrenamientos/data-processor";

interface FileUploaderProps {
  onDataLoaded: (data: TrainingData) => void | Promise<void>;
}

export function FileUploader({ onDataLoaded }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".json")) {
        setError("Por favor, selecciona un archivo JSON válido");
        return;
      }
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target?.result as string) as TrainingData;
          if (!data.sessions || !Array.isArray(data.sessions)) {
            throw new Error("El archivo JSON no tiene la estructura correcta");
          }
          setError(null);
          setSaving(true);
          await onDataLoaded(data);
          setSuccess(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Error desconocido");
          setSuccess(false);
        } finally {
          setSaving(false);
        }
      };
      reader.readAsText(file);
    },
    [onDataLoaded]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFile(files[0]);
  }, [handleFile]);
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) handleFile(files[0]);
  }, [handleFile]);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileJson className="w-6 h-6" />
          Cargar Archivo de Entrenamientos
        </CardTitle>
        <CardDescription>
          Arrastra tu archivo entrenamientos.json o haz clic para seleccionarlo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
          } ${success ? "border-green-500 bg-green-50" : ""} ${error ? "border-red-500 bg-red-50" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          aria-busy={saving}
        >
          <input type="file" accept=".json" onChange={handleFileInput} className="hidden" id="file-upload" />
          <label htmlFor="file-upload" className="cursor-pointer">
            <div className="flex flex-col items-center gap-4">
              {success ? (
                <CheckCircle2 className="w-16 h-16 text-green-500" />
              ) : (
                <Upload className="w-16 h-16 text-muted-foreground" />
              )}
              <div>
                <p className="text-lg font-medium">
                  {success ? "¡Archivo cargado correctamente!" : saving ? "Guardando en servidor..." : "Arrastra tu archivo aquí"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {success ? "Redirigiendo al dashboard..." : saving ? "Espera..." : "o haz clic para seleccionar"}
                </p>
              </div>
              {!success && <Button type="button" variant="outline">Seleccionar archivo</Button>}
            </div>
          </label>
        </div>
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

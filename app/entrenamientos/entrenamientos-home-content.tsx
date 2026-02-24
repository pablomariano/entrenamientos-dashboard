"use client";

import { useRouter } from "next/navigation";
import { FileUploader } from "@/components/entrenamientos/file-uploader";
import { TrainingData } from "@/lib/entrenamientos/data-processor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Download, Upload, BarChart3, Heart } from "lucide-react";

export function EntrenamientosHomeContent() {
  const router = useRouter();

  const handleDataLoaded = (data: TrainingData) => {
    localStorage.setItem("trainingData", JSON.stringify(data));
    router.push("/dashboard/tweakcn");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-700">
      <div className="container mx-auto px-4 py-8 md:py-16">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Activity className="w-12 h-12 text-white" />
            <h1 className="text-4xl md:text-6xl font-bold text-white">
              Dashboard de Entrenamientos
            </h1>
          </div>
          <p className="text-xl text-white/90 max-w-2xl mx-auto">
            Visualiza y analiza tus entrenamientos del Polar RCX5 con gráficos interactivos
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            <Badge className="bg-white/20 text-white border-white/30">
              <Heart className="w-3 h-3 mr-1" />
              Frecuencia Cardíaca
            </Badge>
            <Badge className="bg-white/20 text-white border-white/30">
              <BarChart3 className="w-3 h-3 mr-1" />
              Estadísticas
            </Badge>
            <Badge className="bg-white/20 text-white border-white/30">
              <Activity className="w-3 h-3 mr-1" />
              Análisis Completo
            </Badge>
          </div>
        </div>

        <div className="max-w-4xl mx-auto mb-12">
          <Card className="bg-white/95 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-2xl">¿Cómo obtener tus datos?</CardTitle>
              <CardDescription>
                Sigue estos pasos para exportar tus entrenamientos desde tu Polar RCX5
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">1</div>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Download className="w-5 h-5" />
                    Instalar dependencias
                  </h3>
                  <p className="text-muted-foreground mb-2">Necesitas Python 3.7+ y la librería polar-rcx5-datalink:</p>
                  <code className="block bg-gray-100 p-3 rounded text-sm">pip install polar-rcx5-datalink</code>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">2</div>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Exportar entrenamientos
                  </h3>
                  <p className="text-muted-foreground mb-2">Conecta tu Polar DataLink USB y ejecuta el script de exportación:</p>
                  <code className="block bg-gray-100 p-3 rounded text-sm">python scripts/exportar_para_dashboard.py</code>
                  <p className="text-sm text-muted-foreground mt-2">
                    Esto generará el archivo <strong>entrenamientos.json</strong> en la carpeta entrenamientos_dashboard/
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">3</div>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    Cargar el archivo
                  </h3>
                  <p className="text-muted-foreground">Usa el formulario de abajo para cargar tu archivo JSON y visualizar tus datos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <FileUploader onDataLoaded={handleDataLoaded} />

        <div className="max-w-2xl mx-auto mt-8 text-center text-white/80 text-sm">
          <p>Tus datos se procesan localmente en tu navegador. No se envían a ningún servidor.</p>
        </div>
      </div>
    </main>
  );
}

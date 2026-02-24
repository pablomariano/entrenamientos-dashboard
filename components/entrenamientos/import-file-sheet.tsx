"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { FileUploader } from "@/components/entrenamientos/file-uploader";
import { TrainingData } from "@/lib/entrenamientos/data-processor";
import { saveTrainingData } from "@/lib/entrenamientos/api";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarMenuButton } from "@/components/ui/sidebar";

export function ImportFileSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleDataLoaded = async (data: TrainingData) => {
    await saveTrainingData(data);
    setOpen(false);
    router.push("/dashboard/tweakcn");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <SidebarMenuButton
          tooltip="Importar archivo de entrenamientos"
          className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
        >
          <Upload className="h-4 w-4" />
          <span>Importar archivo</span>
        </SidebarMenuButton>
      </SheetTrigger>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Importar entrenamientos</SheetTitle>
          <SheetDescription>
            Arrastra tu archivo JSON o selecciónalo. Los datos se guardarán en el servidor.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <FileUploader onDataLoaded={handleDataLoaded} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

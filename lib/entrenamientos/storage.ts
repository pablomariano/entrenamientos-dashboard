import { promises as fs } from "fs";
import path from "path";
import { put, get } from "@vercel/blob";
import type { TrainingData } from "./data-processor";

const BLOB_PATHNAME = "entrenamientos.json";

function hasBlobToken(): boolean {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  return typeof token === "string" && token.length > 0;
}

/** Vercel y entornos serverless no permiten escribir en disco. */
function isServerlessEnv(): boolean {
  return process.env.VERCEL === "1";
}

function useBlobStorage(): boolean {
  return hasBlobToken();
}

export function getDataFilePath(): string {
  return path.join(process.cwd(), "data", "entrenamientos.json");
}

export async function readTrainingData(): Promise<TrainingData | null> {
  if (useBlobStorage()) {
    try {
      const result = await get(BLOB_PATHNAME, { access: "private" });
      if (!result || result.statusCode === 304 || !result.stream) return null;
      const text = await new Response(result.stream).text();
      return JSON.parse(text) as TrainingData;
    } catch {
      return null;
    }
  }

  const filePath = getDataFilePath();
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as TrainingData;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

export async function writeTrainingData(data: TrainingData): Promise<void> {
  if (useBlobStorage()) {
    const json = JSON.stringify(data, null, 2);
    await put(BLOB_PATHNAME, json, {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return;
  }

  if (isServerlessEnv()) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN no está configurado. Crea un Blob Store en Vercel: Project → Storage → Create Blob Store. " +
        "La variable se añadirá automáticamente al redesplegar."
    );
  }

  const filePath = getDataFilePath();
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

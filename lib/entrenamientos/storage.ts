import { promises as fs } from "fs";
import path from "path";
import type { TrainingData } from "./data-processor";

const DATA_DIR = "data";
const DATA_FILE = "entrenamientos.json";

export function getDataFilePath(): string {
  return path.join(process.cwd(), DATA_DIR, DATA_FILE);
}

export async function readTrainingData(): Promise<TrainingData | null> {
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
  const filePath = getDataFilePath();
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

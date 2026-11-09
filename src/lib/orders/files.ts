import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const ROOT = path.join(process.cwd(), "storage", "private");

export async function storePrivateFile(file: File) {
  await mkdir(ROOT, { recursive: true });
  const ext = path.extname(file.name) || "";
  const storedName = `${randomUUID()}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(ROOT, storedName), buf);
  return {
    storedName,
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: buf.length,
  };
}

export function privateFilePath(storedName: string) {
  return path.join(ROOT, storedName);
}

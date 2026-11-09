import { existsSync, unlinkSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const db = path.join(root, "prisma", "dev.db");
const journal = `${db}-journal`;
for (const f of [db, journal]) {
  if (existsSync(f)) unlinkSync(f);
}
console.log("Removed local SQLite files (if any).");

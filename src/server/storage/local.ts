import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
export interface FileStorage { save(bytes: Uint8Array): Promise<string>; read(key: string): Promise<Uint8Array>; remove(key: string): Promise<void> }
const root = process.env.MEDIA_DIR || "./media";
export const localFileStorage: FileStorage = {
  async save(bytes) { await mkdir(root, { recursive: true }); const key = randomUUID(); await writeFile(join(/*turbopackIgnore: true*/ root, key), bytes, { flag: "wx" }); return key; },
  async read(key) { if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error("Invalid storage key"); return readFile(join(/*turbopackIgnore: true*/ root, key)); },
  async remove(key) { if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error("Invalid storage key"); await unlink(join(/*turbopackIgnore: true*/ root, key)); },
};

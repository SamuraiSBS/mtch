import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
export interface FileStorage { save(bytes: Uint8Array): Promise<string>; read(key: string): Promise<Uint8Array>; remove(key: string): Promise<void> }
const root = process.env.MEDIA_DIR || "./media";
export const localFileStorage: FileStorage = {
  async save(bytes) { await mkdir(root, { recursive: true }); const key = randomUUID(); const path = join(/*turbopackIgnore: true*/ root, key); try { await writeFile(path, bytes, { flag: "wx" }); return key; } catch (error) { await unlink(path).catch(() => {}); throw error; } },
  async read(key) { if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error("Invalid storage key"); return readFile(join(/*turbopackIgnore: true*/ root, key)); },
  async remove(key) { if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error("Invalid storage key"); try { await unlink(join(/*turbopackIgnore: true*/ root, key)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } },
};

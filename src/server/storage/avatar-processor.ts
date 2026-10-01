import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fail, HttpError } from "@/server/http";

const TIMEOUT_MS = 60_000;
let processing = false;

type Output = { ok: boolean; code?: string; message?: string; durationMs?: number; faces?: number; peakRssMb?: number };

async function runProcessor(input: string, output: string): Promise<Output> {
  const python = process.env.PHOTO_PYTHON || (process.platform === "win32" ? "python" : "python3");
  const script = resolve(process.cwd(), "photo-processor", "processor.py");
  return new Promise((resolveResult, reject) => {
    const child = spawn(/*turbopackIgnore: true*/ python, [script, input, output], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => child.kill(), TIMEOUT_MS);
    child.stdout.on("data", chunk => { stdout += chunk.toString(); if (stdout.length > 4096) child.kill(); });
    child.stderr.on("data", chunk => { stderr += chunk.toString(); if (stderr.length > 8192) child.kill(); });
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("close", code => {
      clearTimeout(timer);
      try {
        const output = JSON.parse(stdout.trim()) as Output;
        if (code !== 0 && output.ok) throw new Error("Inconsistent processor status");
        if (stderr) console.error("avatar processor:", stderr.slice(0, 1000));
        resolveResult(output);
      } catch { reject(new Error(`Photo processor failed (${code}): ${stderr.slice(0, 400)}`)); }
    });
  });
}

export async function processAvatar(source: Uint8Array) {
  if (processing) fail(503, "IMAGE_PROCESSOR_BUSY", "Обработка занята. Попробуйте ещё раз через минуту");
  processing = true;
  const started = Date.now();
  let directory: string | undefined;
  try {
    directory = await mkdtemp(join(tmpdir(), "mtch-avatar-"));
    const input = join(directory, "source");
    const output = join(directory, "output");
    await writeFile(input, source);
    const result = await runProcessor(input, output);
    if (!result.ok) {
      const code = result.code || "IMAGE_PROCESSING_FAILED";
      const status = code === "UNSUPPORTED_FORMAT" ? 415 : ["INVALID_IMAGE", "INVALID_IMAGE_SIZE", "FACE_NOT_FOUND", "BACKGROUND_REMOVAL_FAILED"].includes(code) ? 422 : 500;
      fail(status, code, result.message || "Не удалось обработать фотографию");
    }
    const [large, medium, small] = await Promise.all([800, 256, 64].map(size => readFile(join(output, `avatar_${size}.webp`))));
    for (const bytes of [large, medium, small]) {
      if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") throw new Error("Invalid processor output");
    }
    console.info("avatar processed", { inputBytes: source.length, outputBytes: large.length + medium.length + small.length, faces: result.faces, durationMs: Date.now() - started, peakRssMb: result.peakRssMb });
    return { large, medium, small };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error("avatar processing failed", error);
    return fail(500, "IMAGE_PROCESSING_FAILED", "Не удалось обработать фотографию");
  } finally {
    try { if (directory) await rm(directory, { recursive: true, force: true }); }
    finally { processing = false; }
  }
}

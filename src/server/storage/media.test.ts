import { describe, expect, it } from "vitest";
import { uploadMedia } from "./media";

const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=", "base64");

function form(kind: string, bytes: Uint8Array = tinyPng, type = "image/png") {
  const body = new FormData();
  body.set("kind", kind);
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  body.set("file", new File([copy], "photo.png", { type }));
  return body;
}

describe("media upload guards", () => {
  it("rejects an employer avatar before processing", async () => {
    await expect(uploadMedia("owner", "EMPLOYER", form("AVATAR"))).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("rejects a specialist company photo before processing", async () => {
    await expect(uploadMedia("owner", "SPECIALIST", form("COMPANY_PHOTO"))).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("rejects oversized uploads before reading bytes", async () => {
    await expect(uploadMedia("owner", "SPECIALIST", form("AVATAR", new Uint8Array(5 * 1024 * 1024 + 1)))).rejects.toMatchObject({ status: 413, code: "FILE_TOO_LARGE" });
  });

  it("rejects mismatched MIME and image signature", async () => {
    await expect(uploadMedia("owner", "SPECIALIST", form("AVATAR", tinyPng, "image/jpeg"))).rejects.toMatchObject({ status: 415, code: "UNSUPPORTED_MEDIA" });
  });
});

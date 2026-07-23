import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  if (!filename || filename.includes("..") || filename.includes("/")) {
    return new NextResponse("Invalid filename", { status: 400 });
  }

  const recordingsDir = process.env.RECORDINGS_DIR ?? "/data/recordings";
  const filePath = join(recordingsDir, filename);

  if (!existsSync(filePath)) {
    return new NextResponse("Recording not found", { status: 404 });
  }

  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const contentType =
    ext === "mp4"
      ? "video/mp4"
      : ext === "webm"
        ? "video/webm"
        : ext === "wav"
          ? "audio/wav"
          : "application/octet-stream";

  const file = await import("fs/promises").then((m) => m.readFile(filePath));
  return new NextResponse(file, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": file.byteLength.toString(),
      "Cache-Control": "private, max-age=3600",
    },
  });
}

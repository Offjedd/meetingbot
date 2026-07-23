import { readFileSync, promises as fsPromises, existsSync } from "fs";
import { join } from "path";
import { Bot } from "./bot";
import { randomUUID } from "crypto";

const RECORDINGS_DIR = process.env.RECORDINGS_DIR || "/data/recordings";

/**
 * Saves the recording file to the local disk instead of uploading to S3.
 * The file is copied to a shared recordings directory and the original is cleaned up.
 *
 * @returns The filename of the saved recording (used as the storage key).
 */
export async function uploadRecordingToS3(_s3Client: unknown, bot: Bot): Promise<string> {
  const filePath = bot.getRecordingPath();
  let fileContent: Buffer;
  let i = 10;

  while (true) {
    try {
      fileContent = readFileSync(filePath);
      console.log("Successfully read recording file");
      break;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;

      if (err.code === "EBUSY") {
        console.log("File is busy, retrying...");
        await new Promise(r => setTimeout(r, 1000));
      } else if (err.code === "ENOENT") {
        if (i < 0)
          throw new Error("File not found after multiple retries");
        console.log("File not found, retrying ", i--, " more times");
        await new Promise(r => setTimeout(r, 1000));
      } else {
        throw error;
      }
    }
  }

  const uuid = randomUUID();
  const contentType = bot.getContentType();
  const ext = contentType.split("/")[1] || "mp4";
  const filename = `${uuid}-${bot.settings.meetingInfo.platform}-recording.${ext}`;
  const destPath = join(RECORDINGS_DIR, filename);

  try {
    if (!existsSync(RECORDINGS_DIR)) {
      await fsPromises.mkdir(RECORDINGS_DIR, { recursive: true });
    }
    await fsPromises.writeFile(destPath, fileContent);
    console.log(`Successfully saved recording to local disk: ${filename}`);

    await fsPromises.unlink(filePath);
    return filename;
  } catch (error) {
    console.error("Error saving recording to local disk:", error);
    return '';
  }
}

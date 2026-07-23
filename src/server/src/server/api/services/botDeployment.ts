import { type BotConfig, bots } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "~/server/db/schema";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "~/env";

// Get the directory path using import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const deploymentMode = (env.DEPLOYMENT_MODE ?? "docker").toLowerCase();

/**
 * Maps platform name to the corresponding Docker image name.
 * @param platform - The meeting platform (google, teams, zoom)
 * @returns The Docker image name to use for deployment
 */
export function selectBotDockerImage(
  meetingInfo: schema.MeetingInfo,
): string {
  const platform = meetingInfo.platform;

  switch (platform?.toLowerCase()) {
    case "google":
      return process.env.DOCKER_IMAGE_MEET ?? "meeting-bot-meet";
    case "teams":
      return process.env.DOCKER_IMAGE_TEAMS ?? "meeting-bot-teams";
    case "zoom":
      return process.env.DOCKER_IMAGE_ZOOM ?? "meeting-bot-zoom";
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

export class BotDeploymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BotDeploymentError";
  }
}

export async function deployBot({
  botId,
  db,
}: {
  botId: number;
  db: PostgresJsDatabase<typeof schema>;
}) {
  const botResult = await db.select().from(bots).where(eq(bots.id, botId));
  if (!botResult[0]) {
    throw new Error("Bot not found");
  }
  const bot = botResult[0];
  const dev = env.NODE_ENV === "development";

  // First, update bot status to deploying
  await db.update(bots).set({ status: "DEPLOYING" }).where(eq(bots.id, botId));

  try {
    // Get the absolute path to the bots directory (parent directory)
    const botsDir = path.resolve(__dirname, "../../../../../bots");

    // Merge default config with user provided config

    const config: BotConfig = {
      id: botId,
      userId: bot.userId,
      meetingTitle: bot.meetingTitle,
      meetingInfo: bot.meetingInfo,
      startTime: bot.startTime,
      endTime: bot.endTime,
      botDisplayName: bot.botDisplayName,
      botImage: bot.botImage ?? undefined,
      heartbeatInterval: bot.heartbeatInterval,
      automaticLeave: bot.automaticLeave,
      callbackUrl: bot.callbackUrl ?? undefined,
    };

    if (dev) {
      // Spawn the bot process
      const botProcess = spawn("pnpm", ["start"], {
        cwd: botsDir,
        env: {
          ...process.env,
          BOT_DATA: JSON.stringify(config),
        },
      });

      // Log output for debugging
      botProcess.stdout.on("data", (data) => {
        console.log(`Bot ${botId} stdout: ${data}`);
      });
      botProcess.stderr.on("data", (data) => {
        console.error(`Bot ${botId} stderr: ${data}`);
      });
      botProcess.on("error", (error) => {
        console.error(`Bot ${botId} process error:`, error);
      });
    } else if (deploymentMode === "docker") {
      // Deploy bot as a local Docker container (for VPS deployments like Contabo)
      const dockerImage = selectBotDockerImage(bot.meetingInfo);
      const containerName = `bot-${botId}`;

      const recordingsDir = process.env.RECORDINGS_DIR ?? "/data/recordings";
      const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3000";

      const dockerArgs = [
        "run",
        "-d",
        "--name",
        containerName,
        "--rm",
        "-e",
        `BOT_DATA=${JSON.stringify(config)}`,
        "-e",
        `BACKEND_URL=${backendUrl}`,
        "-e",
        `RECORDINGS_DIR=/data/recordings`,
        "-e",
        `NODE_ENV=production`,
        "-v",
        `${recordingsDir}:/data/recordings`,
        "--shm-size=1g",
        dockerImage,
      ];

      console.log(`Deploying bot ${botId} as Docker container ${containerName} using image ${dockerImage}`);

      const dockerProcess = spawn("docker", dockerArgs, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let dockerStdout = "";
      let dockerStderr = "";

      dockerProcess.stdout.on("data", (data) => {
        dockerStdout += data.toString();
        console.log(`Bot ${botId} docker stdout: ${data}`);
      });
      dockerProcess.stderr.on("data", (data) => {
        dockerStderr += data.toString();
        console.error(`Bot ${botId} docker stderr: ${data}`);
      });

      await new Promise<void>((resolve, reject) => {
        dockerProcess.on("close", (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(
              new BotDeploymentError(
                `Docker container failed to start (exit code ${code}): ${dockerStderr}`,
              ),
            );
          }
        });
        dockerProcess.on("error", (error) => {
          reject(
            new BotDeploymentError(
              `Failed to spawn docker process: ${error.message}. Is Docker installed and in PATH?`,
            ),
          );
        });
      });
    } else {
      throw new BotDeploymentError(
        `Unsupported deployment mode: ${deploymentMode}. Only "docker" is supported.`,
      );
    }

    // Update status to joining call
    const result = await db
      .update(bots)
      .set({
        status: "JOINING_CALL",
        deploymentError: null,
      })
      .where(eq(bots.id, botId))
      .returning();

    if (!result[0]) {
      throw new BotDeploymentError("Bot not found");
    }

    return result[0];
  } catch (error) {
    // Update status to fatal and store error message
    await db
      .update(bots)
      .set({
        status: "FATAL",
        deploymentError:
          error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(bots.id, botId));

    throw error;
  }
}

export async function shouldDeployImmediately(
  startTime: Date | undefined | null,
): Promise<boolean> {
  if (!startTime) return true;

  const now = new Date();
  const deploymentBuffer = 5 * 60 * 1000; // 5 minutes in milliseconds
  return startTime.getTime() - now.getTime() <= deploymentBuffer;
}

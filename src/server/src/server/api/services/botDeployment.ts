import { type BotConfig, bots } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "~/server/db/schema";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import {
  ECSClient,
  type ECSClientConfig,
  RunTaskCommand,
  type RunTaskRequest,
} from "@aws-sdk/client-ecs";
import { env } from "~/env";

// Get the directory path using import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const deploymentMode = (process.env.DEPLOYMENT_MODE ?? "ecs").toLowerCase();

// Only create ECS client if using ECS deployment mode
let client: ECSClient | null = null;
if (deploymentMode === "ecs") {
  const config: ECSClientConfig = {
    region: env.AWS_REGION,
  };

  if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
    config.credentials = {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    };
  }

  client = new ECSClient(config);
}

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

/**
 * Selects the appropriate bot task definition based on meeting information
 * @param meetingInfo - Information about the meeting, including platform
 * @returns The task definition ARN to use for deployment
 */
export function selectBotTaskDefinition(
  meetingInfo: schema.MeetingInfo,
): string {
  const platform = meetingInfo.platform;

  switch (platform?.toLowerCase()) {
    case "google":
      return env.ECS_TASK_DEFINITION_MEET;
    case "teams":
      return env.ECS_TASK_DEFINITION_TEAMS;
    case "zoom":
      return env.ECS_TASK_DEFINITION_ZOOM;
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

      const dockerArgs = [
        "run",
        "-d",
        "--name",
        containerName,
        "--rm",
        "-e",
        `BOT_DATA=${JSON.stringify(config)}`,
        "-e",
        `AWS_BUCKET_NAME=${process.env.AWS_BUCKET_NAME ?? ""}`,
        "-e",
        `AWS_REGION=${process.env.AWS_REGION ?? ""}`,
        "-e",
        `AWS_ACCESS_KEY_ID=${process.env.AWS_ACCESS_KEY_ID ?? ""}`,
        "-e",
        `AWS_SECRET_ACCESS_KEY=${process.env.AWS_SECRET_ACCESS_KEY ?? ""}`,
        "-e",
        `NODE_ENV=production`,
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
              `Failed to spawn docker process: ${error.message}`,
            ),
          );
        });
      });
    } else {
      // ECS Fargate deployment (AWS)
      const input: RunTaskRequest = {
        cluster: env.ECS_CLUSTER_NAME,
        // taskDefinition: env.ECS_TASK_DEFINITION_MEET,
        taskDefinition: selectBotTaskDefinition(bot.meetingInfo),
        launchType: "FARGATE",
        networkConfiguration: {
          awsvpcConfiguration: {
            // Read subnets from environment variables
            subnets: env.ECS_SUBNETS,
            securityGroups: env.ECS_SECURITY_GROUPS,
            assignPublicIp: "ENABLED",
          },
        },
        overrides: {
          containerOverrides: [
            {
              name: "bot",
              environment: [
                {
                  name: "BOT_DATA",
                  value: JSON.stringify(config),
                },
              ],
            },
          ],
        },
      };

      const command = new RunTaskCommand(input);
      await client!.send(command);
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

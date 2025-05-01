import { createClient, RedisClientType } from "redis";
import dotenv from "dotenv";

dotenv.config();

class RedisClient {
  private static instance: RedisClientType;
  private static isInitialized = false;

  private constructor() {}

  public static getInstance(): RedisClientType {
    if (!RedisClient.instance) {
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) {
        throw new Error("REDIS_URL environment variable is not set");
      }

      console.info(
        "Connecting to Redis at:",
        redisUrl.replace(/\/\/.*@/, "//****:****@")
      );

      RedisClient.instance = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error("Max reconnection attempts reached");
              return new Error("Max reconnection attempts reached");
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      RedisClient.instance.on("error", (err) => {
        console.error("Redis Client Error:", err);
      });

      RedisClient.instance.on("connect", () => {
        console.info("Redis Client Connected");
      });

      RedisClient.instance.on("ready", () => {
        console.info("Redis Client Ready");
      });

      RedisClient.instance.on("end", () => {
        console.warn("Redis Client Connection Ended");
      });
    }

    if (!RedisClient.isInitialized) {
      RedisClient.initialize().catch((err) => {
        console.error("Failed to initialize Redis:", err);
        process.exit(1);
      });
    }

    return RedisClient.instance;
  }

  private static async initialize(): Promise<void> {
    try {
      await RedisClient.instance.connect();
      RedisClient.isInitialized = true;
      console.info("Redis client initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Redis client:", error);
      throw error;
    }
  }

  public static async shutdown(): Promise<void> {
    if (RedisClient.instance) {
      try {
        await RedisClient.instance.quit();
        console.warn("Redis client shutdown successfully");
      } catch (error) {
        console.error("Error during Redis client shutdown:", error);
      }
    }
  }
}

// Export a singleton instance
export const redis = RedisClient.getInstance();

// Export the shutdown function for graceful application termination
export const shutdownRedis = RedisClient.shutdown;

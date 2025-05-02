import prisma from "../lib/prisma";
import { redis } from "../lib/redis";
import { User } from "@prisma/client";
import { encryptionService } from "./encryption.service";
import { NotionSessionFlow } from "@/types/notion.types";

export interface UserSession {
  userId: string;
  step: number;
  command: "/start" | "/connect" | "/page" | "/addurl" | "/resources";
  name: string;
  data: NotionSessionFlow;
}

class UserService {
  private static readonly PREFIX = "telegram:";

  static async setUserSession(
    chatId: number,
    data: UserSession
  ): Promise<void> {
    const key = `${this.PREFIX}session:${chatId}`;
    await redis.set(key, JSON.stringify(data), { EX: 3600 }); // Expires in 1 hour
  }

  static async getUserSession(chatId: number): Promise<UserSession | null> {
    const key = `${this.PREFIX}session:${chatId}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  static async deleteUserSession(chatId: number): Promise<void> {
    const key = `${this.PREFIX}session:${chatId}`;
    await redis.del(key);
  }

  static async getUser(chatId: number): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: {
        chatId: chatId.toString(),
      },
    });
    return user;
  }

  static async getUserAccessToken(
    provider: string,
    userId: string
  ): Promise<string | null> {
    const token = await prisma.token.findUnique({
      where: {
        userId_provider: { userId, provider },
      },
    });

    if (!token?.accessToken) {
      return null;
    }

    const decryptedToken = encryptionService.decrypt(token.accessToken);

    return decryptedToken;
  }
}

export default UserService;

import prisma from "../lib/prisma";
import { redis } from "../lib/redis";
import { User } from "@prisma/client";

export interface UserSession {
  step: number;
  command: "/start" | "/connect" | "/page" | "/addurl";
  name: string;
  data: {
    url?: string;
    title?: string;
    type?: string;
    pageId?: string;
    databaseName?: string;
  };
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
}

export default UserService;

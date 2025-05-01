import { encryptionService } from "../services/encryption.service";
import prisma from "../lib/prisma";
import NotionService from "../services/NotionService";
import { Request, Response } from "express";

export class ConnectedAccountsController {
  private static readonly route = "/api/connected-accounts";

  static async get(req: Request, res: Response): Promise<void> {
    try {
      // Your implementation here
      res.status(200).json({ message: "get endpoint working" });
    } catch (error) {
      console.error("Error in get:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async disconnect(req: Request, res: Response): Promise<void> {
    try {
      // Your implementation here
      res.status(200).json({ message: "disconnect endpoint working" });
    } catch (error) {
      console.error("Error in disconnect:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async callback(req: Request, res: Response): Promise<void> {
    try {
      switch (req.params.provider) {
        case "notion":
          const { code, state } = req.query;

          if (!code) {
            res.status(400).json({ error: "No code provided" });
            return;
          }

          if (state) {
            const decoded = JSON.parse(
              Buffer.from(state as string, "base64").toString("utf-8")
            );
            const chatId = decoded.chatId;

            if (!chatId) {
              res.status(400).json({ error: "No chatId provided" });
              return;
            }

            // run transaction
            await prisma.$transaction(async (tx) => {
              let user = await tx.user.findUnique({
                where: {
                  chatId: String(chatId),
                },
              });

              if (!user) {
                user = await prisma.user.create({
                  data: {
                    chatId: String(chatId),
                    name: "",
                    email: "",
                  },
                });
              }

              const notionService = new NotionService();
              const session = await notionService.exchangeCodeForAccessToken(
                req.query.code as string
              );

              // encrypt the access token
              const encryptedAccessToken = encryptionService.encrypt(
                session.access_token
              );

              await prisma.token.upsert({
                where: {
                  userId_provider: {
                    userId: user.id,
                    provider: "notion",
                  },
                },
                update: {
                  accessToken: encryptedAccessToken,
                },
                create: {
                  userId: user.id,
                  provider: "notion",
                  accessToken: encryptedAccessToken,
                },
              });
            });
          }
          break;
      }

      const botUsername = process.env.TELEGRAM_BOT_USERNAME!;
      res.status(302).redirect(`https://t.me/${botUsername}`);
    } catch (error) {
      console.error("Error in callback:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

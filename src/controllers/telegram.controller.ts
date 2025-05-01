import { Request, Response, NextFunction } from "express";
import TelegramBot, { CallbackQuery } from "node-telegram-bot-api";
import UserService, { UserSession } from "../services/UserService";
import NotionService from "../services/NotionService";
import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { PropertyResult } from "../types/notion.types";
import prisma from "../lib/prisma";
import { encryptionService } from "../services/encryption.service";

export class TelegramController {
  private static bot: TelegramBot;
  private static commands: TelegramBot.BotCommand[] = [
    { command: "start", description: "Show command menu" },
    { command: "connect", description: "Connect to a provider" },
    {
      command: "page",
      description: "Setup a page in notion with a database",
    },
  ];
  private static providers: {
    name: string;
    authUrl: string;
    icon: string;
  }[] = [
    { name: "Notion", authUrl: process.env.NOTION_AUTH_URL ?? "", icon: "🔑" },
  ];

  static initialize(bot: TelegramBot): void {
    TelegramController.bot = bot;
    TelegramController.setupBotCommands();
    TelegramController.setupCallbacks();
  }

  private static setupBotCommands(): void {
    TelegramController.bot.setMyCommands(TelegramController.commands);
  }

  private static setupCallbacks(): void {
    TelegramController.bot.on("callback_query", async (query) => {
      const chatId = query.message?.chat.id;
      const data = query.data;

      if (!chatId || !data) return;

      if (data.startsWith("provider:")) {
        await TelegramController.handleReceivedProvider(chatId, data, query);
        return;
      }

      const session = await UserService.getUserSession(chatId);
      if (!session) return;

      if (data.startsWith("select_page:") && session.step === 1) {
        await TelegramController.handleReceivedPage(
          chatId,
          data,
          query,
          session
        );
      } else if (data.startsWith("database_type:") && session.step === 3) {
        await TelegramController.handleReceivedDatabaseType(
          chatId,
          data,
          query,
          session
        );
      }
    });
  }

  static async handleWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      TelegramController.bot.processUpdate(req.body);
      const message = req.body?.message;
      const chatId = message?.chat?.id;
      const text = message?.text?.trim();

      if (!chatId || !text) {
        res.sendStatus(200);
        return;
      }

      // 🔗 Connect to a provider
      if (text === "/connect") {
        await TelegramController.handleConnectCommand(chatId);
      } else if (text === "/start") {
        await TelegramController.handleStartCommand(chatId);
      } else {
        const session = await UserService.getUserSession(chatId);

        // 🟢 Setup a page in notion with a database
        if (text === "/page") {
          await TelegramController.handleSetupPageCommand(chatId, session);
        }
        // 🟢 Step 2 for page flow
        else if (session && session.command === "/page" && session.step === 2) {
          await TelegramController.handleReceivedDatabaseName(
            chatId,
            text,
            session
          );
        }
      }

      res.sendStatus(200);
    } catch (error) {
      console.error("❌ Error in webhook:", error);
      next(error);
    }
  }

  private static async handleStartCommand(chatId: number): Promise<void> {
    await UserService.deleteUserSession(chatId);
    await TelegramController.bot.sendMessage(
      chatId,
      "👋 Welcome! I'm a bot that helps you manage your Notion databases."
    );
  }

  private static async handleConnectCommand(chatId: number): Promise<void> {
    await TelegramController.bot.sendMessage(
      chatId,
      "Select a provider to connect:",
      {
        reply_markup: {
          inline_keyboard: TelegramController.providers.map((provider) => [
            {
              text: `${provider.icon} ${provider.name}`,
              callback_data: `provider:${provider.name}`,
            },
          ]),
        },
      }
    );
  }

  private static async handleReceivedProvider(
    chatId: number,
    data: string,
    query: CallbackQuery
  ): Promise<void> {
    const provider = data.split("provider:")[1];

    switch (provider) {
      case "Notion":
        const notionUrl = new URL(process.env.NOTION_AUTH_URL!);
        const state = Buffer.from(JSON.stringify({ chatId })).toString(
          "base64"
        );
        notionUrl.searchParams.set("state", state);
        await TelegramController.bot.sendMessage(
          chatId,
          `[Open ${provider} Auth Page](${notionUrl.toString()})`,
          { parse_mode: "Markdown" }
        );
        break;
    }

    await TelegramController.bot.answerCallbackQuery(query.id, {
      show_alert: true,
    });
  }

  private static async handleSetupPageCommand(
    chatId: number,
    session: UserSession | null
  ): Promise<void> {
    const loadingMessage = await TelegramController.bot.sendMessage(
      chatId,
      "⏳ Searching for pages..."
    );
    try {
      if (!session) {
        session = {
          step: 0,
          command: "/page",
          name: "Initiate create database in page flow",
          data: {},
        };
      }
      const notion = await TelegramController.getNotionService(chatId);
      const pages = await notion.searchPages();

      session.step = 1;
      await UserService.setUserSession(chatId, session);

      const workspacePages = pages.results.filter(
        (page): page is PageObjectResponse =>
          page.object === "page" &&
          "parent" in page &&
          page.parent?.type === "workspace"
      );

      if (workspacePages.length === 0) {
        await TelegramController.bot.editMessageText(
          "No standalone pages found. Please create a page first.",
          {
            chat_id: chatId,
            message_id: loadingMessage.message_id,
          }
        );
        return;
      }

      const inlineKeyboard = workspacePages.map((page) => {
        const titleProp = page.properties?.["title"];
        const title =
          titleProp?.type === "title" && titleProp.title.length > 0
            ? titleProp.title[0].type === "text"
              ? titleProp.title[0].text.content
              : "(Untitled)"
            : "(Untitled)";

        return [
          {
            text: `📄 ${title}`,
            callback_data: `select_page:${page.id}`,
          },
        ];
      });

      await TelegramController.bot.editMessageText(
        "🗂 Select a Notion page to use:",
        {
          chat_id: chatId,
          message_id: loadingMessage.message_id,
          reply_markup: {
            inline_keyboard: inlineKeyboard,
          },
          parse_mode: "Markdown",
        }
      );
    } catch (error) {
      console.error("❌ Error creating database:", error);
      await TelegramController.bot.editMessageText(
        "❌ Failed to create database. Please try again later.",
        {
          chat_id: chatId,
          message_id: loadingMessage.message_id,
        }
      );
    }
  }

  private static async handleReceivedPage(
    chatId: number,
    data: string,
    query: CallbackQuery,
    session: UserSession
  ): Promise<void> {
    if (session.command !== "/page" && session.step !== 0) return;

    const pageId = data.split("select_page:")[1];

    session.data.pageId = pageId;
    session.step++;
    session.name = "Received page for create database in page flow";
    await UserService.setUserSession(chatId, session);

    await TelegramController.bot.sendMessage(
      chatId,
      "Please send the name of the database:"
    );

    await TelegramController.bot.answerCallbackQuery(query.id, {
      show_alert: true,
    });
  }

  private static async handleReceivedDatabaseName(
    chatId: number,
    text: string,
    session: UserSession
  ): Promise<void> {
    if (session.command !== "/page" && session.step !== 1) return;

    session.data.databaseName = text;
    session.step++;
    session.name = "Received database name for create database in page flow";
    await UserService.setUserSession(chatId, session);

    await TelegramController.bot.sendMessage(
      chatId,
      "Please select the type of database you want to create:",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Resources",
                callback_data: "database_type:resources",
              },
            ],
            [
              {
                text: "Bookmarks",
                callback_data: "database_type:bookmarks",
              },
            ],
            [
              {
                text: "Notes",
                callback_data: "database_type:notes",
              },
            ],
            [
              {
                text: "Salary Tracker",
                callback_data: "database_type:salary",
              },
            ],
          ],
        },
      }
    );
  }

  private static async handleReceivedDatabaseType(
    chatId: number,
    data: string,
    query: CallbackQuery,
    session: UserSession
  ): Promise<void> {
    const loadingMessage = await TelegramController.bot.sendMessage(
      chatId,
      "⏳ Creating database..."
    );

    try {
      if (session.command !== "/page" && session.step !== 3) return;

      const type = data.split("database_type:")[1] as
        | "resources"
        | "bookmarks"
        | "notes"
        | "salary";

      session.name = "Received database type for create database in page flow";
      await UserService.setUserSession(chatId, session);

      const user = await UserService.getUser(chatId);
      if (!user) {
        await TelegramController.bot.editMessageText(
          "❌ User not found. Please connect to notion first.",
          {
            chat_id: chatId,
            message_id: loadingMessage.message_id,
          }
        );
        return;
      }

      const notion = await TelegramController.getNotionService(chatId);
      const database = await notion.createDatabaseInPage(
        session.data.pageId as string,
        session.data.databaseName as string,
        type
      );

      const props: PropertyResult = Object.entries(database.properties).reduce(
        (acc, [key, value]) => {
          const typeKey = value.type;

          const dynamicValue = (value as Record<string, unknown>)[typeKey];

          acc[key] = {
            type: typeKey,
            name: value.name,
            config:
              typeof dynamicValue === "object" && dynamicValue !== null
                ? (dynamicValue as Record<string, unknown>)
                : undefined,
          };

          return acc;
        },
        {} as PropertyResult
      );

      await prisma.notionDatabase.create({
        data: {
          databaseId: database.id,
          userId: user.id,
          properties: JSON.stringify(props),
          url: `https://www.notion.so/s/${database.id}`,
          databaseName: session.data.databaseName as string,
          type: type,
        },
      });

      await UserService.deleteUserSession(chatId);

      await TelegramController.bot.editMessageText(
        "Database created successfully!",
        {
          chat_id: chatId,
          message_id: loadingMessage.message_id,
        }
      );

      await TelegramController.bot.answerCallbackQuery(query.id, {
        show_alert: true,
      });
    } catch (error) {
      await TelegramController.bot.editMessageText(
        "❌ Failed to create database. Please try again later.",
        {
          chat_id: chatId,
          message_id: loadingMessage.message_id,
        }
      );
      console.error("❌ Error creating database:", error);
    }
  }

  private static async getNotionToken(chatId: number): Promise<string> {
    const user = await UserService.getUser(chatId);
    if (!user) throw new Error("Notion user not found");
    const token = await prisma.token.findUnique({
      where: { userId_provider: { userId: user.id, provider: "notion" } },
    });
    if (!token?.accessToken) throw new Error("Notion access token missing");
    return token.accessToken;
  }

  private static async getNotionService(
    chatId: number
  ): Promise<NotionService> {
    const accessToken = await TelegramController.getNotionToken(chatId);
    const decryptedToken = encryptionService.decrypt(accessToken);

    return new NotionService(decryptedToken);
  }
}

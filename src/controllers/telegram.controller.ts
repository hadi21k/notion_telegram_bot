import { Request, Response } from "express";
import { CallbackQuery, InlineKeyboardMarkup } from "node-telegram-bot-api";
import UserService, { UserSession } from "../services/UserService";
import NotionService from "../services/NotionService";
import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { NotionProp, PropertyResult, RawValues } from "../types/notion.types";
import prisma from "../lib/prisma";
import bot from "../lib/telegram";
import telegramService from "../services/telegram.service";
import { isValidIsoDate } from "../utils/date";

export class TelegramController {
  private static providers: {
    name: string;
    authUrl: string;
    icon: string;
  }[] = [
    { name: "Notion", authUrl: process.env.NOTION_AUTH_URL ?? "", icon: "🔑" },
  ];

  constructor() {
    this.setupCallbacks();
  }

  private setupCallbacks(): void {
    bot.on("callback_query", async (query) => {
      try {
        const chatId = query.message?.chat.id;
        const data = query.data;

        if (!chatId || !data) return;

        if (data.startsWith("provider:")) {
          await this.handleReceivedProvider(chatId, data, query);
          return;
        }

        const session = await UserService.getUserSession(chatId);
        if (!session) {
          await telegramService.answerCallbackQuery(query.id, {
            show_alert: true,
            text: "No session found. Please start a new session.",
          });
          return;
        }

        if (data.startsWith("select_page:") && session.step === 1) {
          await this.handleReceivedPage(
            chatId,
            data.split("select_page:")[1],
            query,
            session
          );
        } else if (data.startsWith("database_type:") && session.step === 3) {
          const type = data.split("database_type:")[1] as
            | "resources"
            | "bookmarks"
            | "notes"
            | "salary";
          await this.handleReceivedDatabaseType(chatId, type, query, session);
        } else if (data.startsWith("select_database:") && session.step === 1) {
          await this.handleReceivedDatabase(
            chatId,
            data.split("select_database:")[1],
            query,
            session
          );
        } else if (data.startsWith("property:") && session.step === 2) {
          await this.handlePropertySelection(
            chatId,
            data.split("property:")[1],
            query,
            session
          );
        } else if (
          data.startsWith("property_option:") &&
          session.step === 2 &&
          session.data.currentProperty
        ) {
          await this.handlePropertyValue(
            chatId,
            data.split("property_option:")[1],
            session,
            query
          );
        } else if (
          data.startsWith("property_option:") &&
          session.step === 2 &&
          session.data.currentProperty
        ) {
          await this.handlePropertyValue(
            chatId,
            data.split("property_option:")[1],
            session,
            query
          );
        } else if (data.startsWith("property_done")) {
          await this.handleDatabasePropertiesDone(chatId, session);
        } else if (data.startsWith("property_cancel")) {
          await this.handleDatabasePropertiesCancel(chatId);
        }
      } catch (error) {
        await telegramService.handleError(
          error,
          query.message!.chat.id,
          undefined,
          query
        );
      }
    });
  }

  public async handleWebhook(req: Request, res: Response): Promise<void> {
    bot.processUpdate(req.body);
    const message = req.body?.message;
    const chatId = message?.chat?.id;
    const text = message?.text?.trim();
    try {
      if (!chatId || !text) {
        res.sendStatus(200);
        return;
      }

      // 🔗 Connect to a provider
      if (text === "/connect") {
        await this.handleConnectCommand(chatId);
      } else if (text === "/start") {
        await this.handleStartCommand(chatId);
      } else if (text === "/resources") {
        await this.handleSetupResourcesCommand(chatId);
      } else if (text === "/page") {
        await this.handleSetupPageCommand(chatId);
      } else {
        const session = await UserService.getUserSession(chatId);

        if (!session) {
          await telegramService.sendMessage(
            chatId,
            "No session found. Please start a new session."
          );
          return;
        }

        if (session.command === "/page" && session.step === 2) {
          await this.handleReceivedDatabaseName(chatId, text, session);
        }
        // 🟢 Add resources to the database
        else if (
          session.command === "/resources" &&
          session.step === 2 &&
          session.data.currentProperty
        ) {
          await this.handlePropertyValue(chatId, text, session);
        }
      }

      res.sendStatus(200);
    } catch (error) {
      await telegramService.handleError(error, chatId);
    }
  }

  private async handleStartCommand(chatId: number): Promise<void> {
    await UserService.deleteUserSession(chatId);
    await telegramService.sendMessage(
      chatId,
      "👋 Welcome! I'm a bot that helps you manage your Notion databases."
    );
  }

  private async handleConnectCommand(chatId: number): Promise<void> {
    await telegramService.sendMessage(chatId, "Select a provider to connect:", {
      reply_markup: {
        inline_keyboard: TelegramController.providers.map((provider) => [
          {
            text: `${provider.icon} ${provider.name}`,
            callback_data: `provider:${provider.name}`,
          },
        ]),
      },
    });
  }

  private async handleSetupResourcesCommand(chatId: number): Promise<void> {
    const loadingMessage = await telegramService.sendMessage(
      chatId,
      "⏳ Searching for saved databases..."
    );

    try {
      const user = await UserService.getUser(chatId);

      if (!user) {
        await telegramService.editMessageText(
          chatId,
          loadingMessage.message_id,
          "❌ User not found. Please connect to Notion first."
        );
        return;
      }

      const session = {
        step: 1,
        command: "/resources",
        userId: user.id,
        name: "Initiate add resources to the database flow",
        data: {},
      } as UserSession;
      await UserService.setUserSession(chatId, session);

      const databases = await prisma.notionDatabase.findMany({
        select: {
          databaseId: true,
          databaseName: true,
        },
        where: {
          userId: user.id,
        },
      });

      const inlineKeyboard = databases.map((database) => {
        return [
          {
            text: database.databaseName,
            callback_data: `select_database:${database.databaseId}`,
          },
        ];
      });

      await telegramService.editMessageText(
        chatId,
        loadingMessage.message_id,
        "🗂 Select a database to add resources to:",
        {
          reply_markup: {
            inline_keyboard: inlineKeyboard,
          },
        }
      );
    } catch (error) {
      await telegramService.handleError(error, chatId);
    }
  }
  private async handleReceivedProvider(
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
        await telegramService.sendMessage(
          chatId,
          `[Open ${provider} Auth Page](${notionUrl.toString()})`,
          { parse_mode: "Markdown" }
        );
        break;
    }

    await telegramService.answerCallbackQuery(query.id, {
      show_alert: true,
    });
  }

  private async handleSetupPageCommand(chatId: number): Promise<void> {
    const loadingMessage = await telegramService.sendMessage(
      chatId,
      "⏳ Searching for pages..."
    );
    try {
      const user = await UserService.getUser(chatId);
      if (!user) {
        await telegramService.editMessageText(
          chatId,
          loadingMessage.message_id,
          "❌ User not found. Please connect to Notion first."
        );
        return;
      }

      const session = {
        step: 1,
        command: "/page",
        name: "Initiate create database in page flow",
        data: {},
        userId: user.id,
      } as UserSession;
      await UserService.setUserSession(chatId, session);

      const accessToken = await UserService.getUserAccessToken(
        "notion",
        user.id
      );

      if (!accessToken) {
        await telegramService.editMessageText(
          chatId,
          loadingMessage.message_id,
          "❌ Notion access token missing. Please reconnect to Notion"
        );
        return;
      }

      const notion = new NotionService(accessToken);
      const pages = await notion.searchPages();

      const workspacePages = pages.results.filter(
        (page): page is PageObjectResponse =>
          page.object === "page" &&
          "parent" in page &&
          page.parent?.type === "workspace"
      );

      if (workspacePages.length === 0) {
        await telegramService.editMessageText(
          chatId,
          loadingMessage.message_id,
          "No standalone pages found. Please create a page first."
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

      await telegramService.editMessageText(
        chatId,
        loadingMessage.message_id,
        "🗂 Select a Notion page to use:",
        {
          reply_markup: {
            inline_keyboard: inlineKeyboard,
          },
          parse_mode: "Markdown",
        }
      );
    } catch (error) {
      await telegramService.handleError(error, chatId, loadingMessage);
    }
  }

  private async handleReceivedPage(
    chatId: number,
    pageId: string,
    query: CallbackQuery,
    session: UserSession
  ): Promise<void> {
    if (session.command !== "/page" && session.step !== 0) return;

    session.data.pageId = pageId;
    session.step++;
    session.name = "Received page for create database in page flow";
    await UserService.setUserSession(chatId, session);

    await telegramService.sendMessage(
      chatId,
      "Please send the name of the database:"
    );

    await telegramService.answerCallbackQuery(query.id, {
      show_alert: true,
    });
  }

  private async handleReceivedDatabaseName(
    chatId: number,
    text: string,
    session: UserSession
  ): Promise<void> {
    if (session.command !== "/page" && session.step !== 1) return;

    session.data.databaseName = text;
    session.step++;
    session.name = "Received database name for create database in page flow";
    await UserService.setUserSession(chatId, session);

    await telegramService.sendMessage(
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

  private async handleReceivedDatabaseType(
    chatId: number,
    type: "resources" | "bookmarks" | "notes" | "salary",
    query: CallbackQuery,
    session: UserSession
  ): Promise<void> {
    const loadingMessage = await telegramService.sendMessage(
      chatId,
      "⏳ Creating database..."
    );

    try {
      if (session.command !== "/page" && session.step !== 3) return;

      session.name = "Received database type for create database in page flow";
      await UserService.setUserSession(chatId, session);

      const accessToken = await UserService.getUserAccessToken(
        "notion",
        session.userId
      );

      if (!accessToken) {
        await telegramService.editMessageText(
          chatId,
          loadingMessage.message_id,
          "❌ Notion access token missing. Please reconnect to Notion"
        );
        return;
      }

      const notion = new NotionService(accessToken);
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
          userId: session.userId,
          properties: JSON.stringify(props),
          url: `https://www.notion.so/s/${database.id}`,
          databaseName: session.data.databaseName as string,
          type: type,
        },
      });

      await UserService.deleteUserSession(chatId);

      await telegramService.editMessageText(
        chatId,
        loadingMessage.message_id,
        "Database created successfully!"
      );

      await telegramService.answerCallbackQuery(query.id, {
        show_alert: true,
      });
    } catch (error) {
      await telegramService.handleError(error, chatId, loadingMessage);
    }
  }

  private async handleReceivedDatabase(
    chatId: number,
    databaseId: string,
    query: CallbackQuery,
    session: UserSession
  ): Promise<void> {
    const loadingMessage = await telegramService.sendMessage(
      chatId,
      "⏳ Getting properties..."
    );

    try {
      if (session.command !== "/resources" && session.step !== 1) return;

      if (!session.userId) {
        await telegramService.editMessageText(
          chatId,
          loadingMessage.message_id,
          "❌ User not found. Please connect to notion first."
        );
        return;
      }

      const database = await prisma.notionDatabase.findUnique({
        where: {
          databaseId: databaseId,
          userId: session.userId,
        },
      });

      if (!database) {
        await telegramService.editMessageText(
          chatId,
          loadingMessage.message_id,
          "❌ Database not found. You might have deleted this database. Please setup a new database using /page command."
        );
        return;
      }

      session.step++;
      session.name =
        "Received database properties for add resources to database flow";
      session.data.props = JSON.parse(
        database.properties as string
      ) as PropertyResult;
      session.data.remainingProps = JSON.parse(
        database.properties as string
      ) as PropertyResult;
      session.data.databaseId = databaseId;
      await UserService.setUserSession(chatId, session);

      const keyboard = this.buildPropertyKeyboard(
        database.properties as string
      );

      await telegramService.editMessageText(
        chatId,
        loadingMessage.message_id,
        "Please select the property you want to add:",
        {
          reply_markup: keyboard,
        }
      );
    } catch (error) {
      await telegramService.handleError(error, chatId, loadingMessage);
    }
  }

  private buildPropertyKeyboard(saved: string): InlineKeyboardMarkup {
    const props = JSON.parse(saved) as Record<string, NotionProp>;

    // map Notion types to emojis (tweak as you like)
    const icons: Record<string, string> = {
      title: "🔤",
      rich_text: "✏️",
      number: "🔢",
      select: "🔘",
      multi_select: "✔️",
      date: "📅",
    };

    const rows = Object.entries(props).map(([key, { name, type }]) => [
      {
        text: `${icons[type] || ""} ${name}`,
        callback_data: `property:${key}`,
      },
    ]);

    rows.push([
      { text: "✅ Done", callback_data: `property_done` },
      { text: "❌ Cancel", callback_data: `property_cancel` },
    ]);

    return { inline_keyboard: rows };
  }

  private async handlePropertySelection(
    chatId: number,
    propKey: string,
    query: CallbackQuery,
    session: UserSession
  ): Promise<void> {
    const prop = session.data.remainingProps?.[propKey] as NotionProp;
    session.data.currentProperty = propKey;
    await UserService.setUserSession(chatId, session);

    if (!prop) {
      await telegramService.sendMessage(
        chatId,
        "❌ Property not found. Please try again."
      );
      return;
    }

    // ask according to type:
    switch (prop.type) {
      case "title":
      case "rich_text":
        await telegramService.sendMessage(
          chatId,
          `✏️ Send text for *${prop.name}*`,
          { parse_mode: "Markdown" }
        );
        break;

      case "number":
        await telegramService.sendMessage(
          chatId,
          `🔢 Send a number for *${prop.name}*`,
          { parse_mode: "Markdown" }
        );
        break;

      case "date":
        await telegramService.sendMessage(
          chatId,
          `📅 Send date (YYYY-MM-DD) for *${prop.name}*`,
          { parse_mode: "Markdown" }
        );
        break;

      case "select":
      case "multi_select":
        const options = prop.config.options as Array<{
          id: string;
          name: string;
        }>;
        const rows = options.map((o) => [
          { text: o.name, callback_data: `property_option:${o.id}` },
        ]);
        await telegramService.sendMessage(
          chatId,
          `🔘 Choose for *${prop.name}*:`,
          {
            reply_markup: { inline_keyboard: rows },
            parse_mode: "Markdown",
          }
        );
        break;
    }

    await telegramService.answerCallbackQuery(query.id);
  }

  private async handlePropertyValue(
    chatId: number,
    raw: string,
    session: UserSession,
    query?: CallbackQuery
  ): Promise<void> {
    const key = session.data.currentProperty!;
    session.data.values = session.data.values || {};

    // in your controller, inside handlePropertyValue:
    if (session.data.currentProperty === "DatePaid") {
      const text = raw as string;
      if (!isValidIsoDate(text)) {
        await telegramService.sendMessage(
          chatId,
          "❌ That doesn’t look like `YYYY-MM-DD`. Please send a valid date, e.g. `2025-10-20`."
        );
        return;
      }
    }

    session.data.values[key] = raw;
    delete session.data.currentProperty;

    // rebuild keyboard, filtering out done keys:
    const remainingProps = Object.fromEntries(
      Object.entries(session.data.props || {}).filter(
        ([k]) => !(k in (session.data.values ?? {}))
      )
    );
    session.data.remainingProps = remainingProps;
    await UserService.setUserSession(chatId, session);

    if (Object.keys(remainingProps).length === 0) {
      await this.handleDatabasePropertiesDone(chatId, session);
      return;
    }

    const keyboard = this.buildPropertyKeyboard(JSON.stringify(remainingProps));
    await telegramService.sendMessage(chatId, "Select next property:", {
      reply_markup: keyboard,
    });

    if (query) await telegramService.answerCallbackQuery(query.id);
  }

  private async handleDatabasePropertiesDone(
    chatId: number,
    session: UserSession
  ): Promise<void> {
    const loadingMessage = await telegramService.sendMessage(
      chatId,
      "⏳ Adding resource to database..."
    );

    try {
      const accessToken = await UserService.getUserAccessToken(
        "notion",
        session.userId
      );

      if (!accessToken) {
        await telegramService.editMessageText(
          chatId,
          loadingMessage.message_id,
          "❌ You are not connected to Notion. Please connect to Notion first."
        );
        return;
      }

      const values = session.data.values;
      const notion = new NotionService(accessToken);
      await notion.addPage(
        session.data.databaseId as string,
        session.data.props as PropertyResult,
        values as RawValues
      );

      await telegramService.editMessageText(
        chatId,
        loadingMessage.message_id,
        "Resource has been added to the database!"
      );
    } catch (error) {
      await UserService.deleteUserSession(chatId);
      await telegramService.handleError(error, chatId, loadingMessage);
    }
  }

  private async handleDatabasePropertiesCancel(chatId: number): Promise<void> {
    await UserService.deleteUserSession(chatId);
    await telegramService.sendMessage(chatId, "Properties addition cancelled.");
  }
}

export default TelegramController;

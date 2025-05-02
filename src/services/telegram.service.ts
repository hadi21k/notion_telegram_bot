import {
  CallbackQuery,
  EditMessageTextOptions,
  Message,
  SendMessageOptions,
} from "node-telegram-bot-api";
import { StatusError } from "../helpers/StatusError";
import bot from "../lib/telegram";

export class TelegramService {
  private static instance: TelegramService;

  private constructor() {}

  public static getInstance(): TelegramService {
    if (!TelegramService.instance) {
      TelegramService.instance = new TelegramService();
    }
    return TelegramService.instance;
  }

  public async sendMessage(
    chatId: number,
    text: string,
    options?: SendMessageOptions
  ): Promise<Message> {
    return bot.sendMessage(chatId, text, options);
  }

  public async editMessageText(
    chatId: number,
    messageId: number,
    text: string,
    options?: EditMessageTextOptions
  ): Promise<Message | boolean> {
    return bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      ...options,
    });
  }

  public async answerCallbackQuery(
    queryId: string,
    options?: { show_alert?: boolean; text?: string }
  ): Promise<boolean> {
    return bot.answerCallbackQuery(queryId, options);
  }

  public async handleError(
    error: unknown,
    chatId: number,
    messageToEdit?: Message,
    query?: CallbackQuery
  ): Promise<void> {
    console.error("❌ Error:", error);

    const errorMessage = StatusError.isStatusError(error)
      ? error.message
      : "An unexpected error occurred. Please try again later.";

    if (messageToEdit) {
      await this.editMessageText(
        chatId,
        messageToEdit.message_id,
        errorMessage
      );
    }

    if (query) {
      await this.answerCallbackQuery(query.id, {
        show_alert: true,
        text: errorMessage,
      });
    }
  }
}

export default TelegramService.getInstance();

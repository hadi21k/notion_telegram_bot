import TelegramBot from "node-telegram-bot-api";

export interface TelegramBotConfig {
  token: string;
  port?: number;
  commands?: TelegramBot.BotCommand[];
  options?: TelegramBot.ConstructorOptions;
}

export class TelegramBotInstance {
  private static instance: TelegramBotInstance;
  private bot: TelegramBot;

  private constructor(config: TelegramBotConfig) {
    const defaultOptions: TelegramBot.ConstructorOptions = {
      webHook: {
        port: config.port || 3000,
      },
    };

    this.bot = new TelegramBot(config.token, {
      ...defaultOptions,
      ...config.options,
    });

    if (config.commands) {
      this.bot.setMyCommands(config.commands);
    }
  }

  public static getInstance(config: TelegramBotConfig): TelegramBotInstance {
    if (!TelegramBotInstance.instance) {
      TelegramBotInstance.instance = new TelegramBotInstance(config);
    }
    return TelegramBotInstance.instance;
  }

  public getBot(): TelegramBot {
    return this.bot;
  }
}

const defaultConfig: TelegramBotConfig = {
  token: process.env.TELEGRAM_BOT_TOKEN as string,
  port: Number(process.env.PORT) || 3000,
  commands: [
    { command: "start", description: "Show command menu" },
    { command: "connect", description: "Connect to a provider" },
    { command: "page", description: "Setup a page in notion with a database" },
    { command: "resources", description: "Add resources to the database" },
  ],
};

const bot = TelegramBotInstance.getInstance(defaultConfig).getBot();
export default bot;

import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import https from "https";
import fs from "fs";
import TelegramBot from "node-telegram-bot-api";
import { TelegramController } from "./controllers/telegram.controller";
import telegramRoutes from "./routes/telegram.routes";
import routes from "./routes";

dotenv.config();

const app: Express = express();

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

const server = https.createServer(
  {
    key: fs.readFileSync("./key.pem", "utf8"),
    cert: fs.readFileSync("./server.crt", "utf8"),
  },
  app
);

const botToken = process.env.TELEGRAM_BOT_TOKEN as string;
// const webhookSecret = process.env.WEBHOOK_SECRET as string;
const webhookPath = `/bot${botToken}`;

const options: TelegramBot.ConstructorOptions = {
  webHook: {
    port: Number(PORT),
  },
};

const bot = new TelegramBot(botToken, options);

TelegramController.initialize(bot);

app.use(webhookPath, telegramRoutes);

app.use("/api", routes);

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "OK" });
});

export default server;
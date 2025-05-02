import connectedAccountsRoutes from "./connected-accounts.routes";
import telegramRoutes from "./telegram.routes";
import { Router } from "express";

const router = Router();

const botToken = process.env.TELEGRAM_BOT_TOKEN as string;
const webhookPath = `/bot${botToken}`;

router.use(webhookPath, telegramRoutes);

router.use("/connected-accounts", connectedAccountsRoutes);

export default router;

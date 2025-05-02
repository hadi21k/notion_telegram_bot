import { Router } from "express";
import TelegramController from "../controllers/telegram.controller";

const router = Router();

const telegramController = new TelegramController();

router.post("/", telegramController.handleWebhook.bind(telegramController));

export default router;

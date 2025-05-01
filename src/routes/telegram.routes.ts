import { Router } from "express";
import { TelegramController } from "../controllers/telegram.controller";

const router = Router();

router.post("/", TelegramController.handleWebhook);

export default router;

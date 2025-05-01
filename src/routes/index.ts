import connectedAccountsRoutes from "./connected-accounts.routes";
import telegramRoutes from "./telegram.routes";
import { Router } from "express";

const router = Router();

router.use("/telegram", telegramRoutes);

router.use("/connected-accounts", connectedAccountsRoutes);

export default router;

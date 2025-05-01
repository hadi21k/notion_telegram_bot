import { Router } from "express";
import { ConnectedAccountsController } from "../controllers/connected-accounts.controller";

const router = Router();

router.get("/", ConnectedAccountsController.get);
// router.post("/:provider/disconnect", ConnectedAccountsController.disconnect);
router.get("/:provider/callback", ConnectedAccountsController.callback);

export default router;

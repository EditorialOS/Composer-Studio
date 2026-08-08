import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import mcpRouter from "./mcp.js";
import restRouter from "./rest.js";
import billingRouter from "./billing.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(mcpRouter);
router.use(restRouter);
router.use(billingRouter);

export default router;

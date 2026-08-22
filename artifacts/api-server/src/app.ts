import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { STUDIO_HTML } from "./ui";

const app: Express = express();

app.disable('x-powered-by');

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const corsOrigin = process.env['CORS_ORIGIN'];
if (corsOrigin) {
  const origins = corsOrigin.split(',').map((o) => o.trim());
  app.use(cors({ origin: origins }));
} else {
  app.use(cors()); // open by default for local dev; set CORS_ORIGIN in production
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Operator console — the human screen over the engine, served at the root.
app.get("/", (_req, res) => {
  res.type("html").send(STUDIO_HTML);
});

export default app;

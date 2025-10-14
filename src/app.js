import compression from "compression";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import apiRouter from "./routes/api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");

export function createApp() {
  const app = express();

  app.use(compression());
  app.use(express.json());
  app.use("/api", apiRouter);
  app.use(express.static(publicDir));

  app.use((err, _req, res, _next) => {
    console.error("Unexpected error", err);
    res.status(500).json({
      error: "Unexpected server error",
      message: err.message ?? "Unknown error"
    });
  });

  return app;
}

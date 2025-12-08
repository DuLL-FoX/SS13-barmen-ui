import compression from "compression";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import apiRouter from "./routes/api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const reactDistDir = path.resolve(__dirname, "../client/dist");
const assetsDir = path.resolve(__dirname, "../public/assets");

export function createApp() {
  const app = express();

  app.use(compression());
  app.use(express.json());
  app.use("/api", apiRouter);

  app.use("/assets", express.static(assetsDir));

  app.get("/favicon.png", (_req, res) => {
    res.sendFile(path.join(assetsDir, "../favicon.png"));
  });

  app.use(express.static(reactDistDir));

  app.get("*", (_req, res) => {
    res.sendFile(path.join(reactDistDir, "index.html"));
  });

  app.use((err, _req, res, _next) => {
    console.error("Unexpected error", err);
    res.status(500).json({
      error: "Unexpected server error",
      message: err.message ?? "Unknown error"
    });
  });

  return app;
}

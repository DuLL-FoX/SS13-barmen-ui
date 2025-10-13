import "dotenv/config";
import { createApp } from "./app.js";
import { preloadDataset } from "./services/datasetService.js";

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;

async function startServer() {
  const app = createApp();

  if (!process.env.GITHUB_TOKEN) {
    console.warn(
      "GITHUB_TOKEN is not set. GitHub API requests are limited to 60 per hour without a token; set this environment variable to avoid rate limit errors."
    );
  }

  try {
    await preloadDataset();
  } catch (error) {
    console.error("Failed to preload recipe dataset", error);
    process.exitCode = 1;
    return;
  }

  app.listen(PORT, () => {
    console.log(`Bartender recipe service running on http://localhost:${PORT}`);
  });
}

startServer();

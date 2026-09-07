import { defineConfig } from "@playwright/test";

const PORT = 4331;
const HOST = `http://127.0.0.1:${PORT}`;
const serve = `--host 127.0.0.1 --port ${PORT}`;

export default defineConfig({
  testDir: "tests",
  timeout: 3 * 60 * 1000,
  use: { baseURL: HOST },
  webServer: {
    command: process.env.CI ? `pnpm build && pnpm preview ${serve}` : `pnpm dev ${serve}`,
    env: { ASTRO_DEV_BACKGROUND: "1", ASTRO_PREVIEW_BACKGROUND: "1" },
    url: HOST,
    timeout: 15 * 60 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});

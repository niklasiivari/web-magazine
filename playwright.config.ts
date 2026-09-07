import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  use: { baseURL: "http://127.0.0.1:4321" },
  webServer: {
    command: "pnpm dev --host 127.0.0.1 --port 4321",
    env: {
      ASTRO_DEV_BACKGROUND: "1",
    },
    url: "http://127.0.0.1:4321",
    reuseExistingServer: !process.env.CI,
  },
});

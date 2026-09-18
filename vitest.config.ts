import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Calendar fixtures use Czech wall time; a separate subprocess test checks UTC servers.
process.env.TZ = "Europe/Prague";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
    coverage: {
      include: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.ts", "convex/**/*.ts"],
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/**", ".next/**", "convex/_generated/**", "**/*.test.{ts,tsx}", "e2e/**", "**/*.config.*"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});

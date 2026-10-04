import { defineConfig } from "vitest/config";
import { resolve } from "path";

// Node-environment unit tests only — deliberately NOT jsdom/React Testing
// Library. The risk in this codebase concentrates in pure server-side logic
// (money arithmetic, HMAC signing/verification, redirect validation, Zod
// schemas at Server Action boundaries), and all of that is testable without
// a DOM. Component/E2E coverage is a separate decision, not assumed here.
//
// No DB is touched by any of these tests: anything importing a Supabase
// client is excluded by construction — we test the pure functions those
// modules depend on, not the modules that perform I/O.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "lib/utils/**/*.ts",
        "lib/validation/**/*.ts",
        "lib/services/triumph-tracking-cookie.ts",
        "lib/services/triumph-email-verification.ts",
        "lib/email/**/*.ts",
      ],
      reporter: ["text", "html"],
    },
  },
  resolve: {
    alias: {
      // Mirrors the "@/*" path alias in tsconfig.json so test imports read
      // identically to application imports.
      "@": resolve(__dirname, "."),
      // `server-only` throws by design when imported outside a React Server
      // Component. That guard is correct in production and stays — this
      // no-op swap applies only under Vitest, so the server-side modules it
      // protects remain testable. See tests/stubs/server-only.ts.
      "server-only": resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});

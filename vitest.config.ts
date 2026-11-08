import { execSync } from "node:child_process";
import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const env = loadEnv("test", process.cwd(), "");
const url = new URL(env.TEST_DATABASE_URL ?? env.DATABASE_URL);
if (!env.TEST_DATABASE_URL) url.pathname = `${url.pathname}_test`;
// Tests write and wipe rows: never let them reach a remote or non-test database.
if (!["127.0.0.1", "localhost"].includes(url.hostname) || !url.pathname.endsWith("_test")) {
    throw new Error(`Refusing to run tests against ${url.hostname}${url.pathname}`);
}
process.env.DATABASE_URL = url.toString();
execSync("npx prisma db push --skip-generate", { stdio: "inherit", env: process.env });
execSync("npm run db:constraints", { stdio: "inherit", env: process.env });

export default defineConfig({
    resolve: { alias: { "@": path.resolve(__dirname) } },
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
        env: { DATABASE_URL: url.toString(), JWT_SECRET: "test-secret", RESEND_API_KEY: "" },
        fileParallelism: false,
    },
});

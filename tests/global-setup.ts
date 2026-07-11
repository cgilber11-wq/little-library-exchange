import { execSync } from "child_process";
import path from "path";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ||
  "postgresql://lle:lle@127.0.0.1:54329/little_library_exchange_test?schema=public";

export default async function globalSetup() {
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "inherit",
  });
}

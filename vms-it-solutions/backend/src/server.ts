import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";
import { connectRedis, redis } from "./config/redis";

async function main() {
  await prisma.$connect();
  console.log("[db] connected");
  await connectRedis();

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[api] VMS IT Solutions API listening on :${env.port}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[api] ${signal} received — shutting down`);
    server.close(async () => {
      await prisma.$disconnect();
      redis.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[api] failed to start", err);
  process.exit(1);
});

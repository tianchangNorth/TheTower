import cors from "@fastify/cors";
import Fastify from "fastify";
import { isIP } from "node:net";
import { createAppContext } from "./bootstrap.js";
import { registerRoutes } from "./routes.js";

export type AppContext = ReturnType<typeof createAppContext>;

export async function buildApp(ctx: AppContext = createAppContext(), logger = true) {
  const app = Fastify({ logger });
  const host = process.env.HOST ?? "127.0.0.1";
  const operatorToken = process.env.THE_TOWER_OPERATOR_TOKEN;
  if (!isLoopbackHost(host) && !operatorToken) {
    throw new Error("Refusing non-loopback API bind without THE_TOWER_OPERATOR_TOKEN.");
  }
  await app.register(cors, { origin: allowedOrigins() });
  if (!isLoopbackHost(host)) {
    app.addHook("onRequest", async (request, reply) => {
      if (request.url === "/health") return;
      if (request.headers.authorization !== `Bearer ${operatorToken}`) {
        return reply.code(401).send({ error: "operator authorization required" });
      }
    });
  }
  await registerRoutes(app, ctx);
  return app;
}

function allowedOrigins(): string[] {
  const configured = process.env.THE_TOWER_ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean);
  return configured?.length
    ? configured
    : ["http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:3000", "http://localhost:3000"];
}

export function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "::1" || (isIP(host) === 4 && host.startsWith("127."));
}

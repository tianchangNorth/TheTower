import cors from "@fastify/cors";
import Fastify from "fastify";
import { createAppContext } from "./bootstrap.js";
import { registerRoutes } from "./routes.js";

export type AppContext = ReturnType<typeof createAppContext>;

export async function buildApp(ctx: AppContext = createAppContext(), logger = true) {
  const app = Fastify({ logger });
  await app.register(cors, { origin: true });
  await registerRoutes(app, ctx);
  return app;
}

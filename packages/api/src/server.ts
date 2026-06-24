import cors from "@fastify/cors";
import Fastify from "fastify";
import { createAppContext } from "./bootstrap.js";
import { registerRoutes } from "./routes.js";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

const ctx = createAppContext();
await registerRoutes(app, ctx);

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";

await app.listen({ port, host });

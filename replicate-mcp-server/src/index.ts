import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import { ReplicateClient } from "./services/replicate.js";
import { registerTools } from "./tools/predictions.js";

const API_KEY = process.env.REPLICATE_API_TOKEN;
if (!API_KEY) {
  console.error("Error: REPLICATE_API_TOKEN environment variable is required");
  process.exit(1);
}

const client = new ReplicateClient(API_KEY);

function createServer(): McpServer {
  const server = new McpServer({
    name: "replicate-mcp-server",
    version: "1.0.0",
  });
  registerTools(server, client);
  return server;
}

async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "replicate-mcp-server" });
  });

  const port = parseInt(process.env.PORT ?? "3000");
  app.listen(port, () => {
    console.error(`Replicate MCP server running on http://localhost:${port}/mcp`);
  });
}

async function runStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Replicate MCP server running on stdio");
}

const transport = process.env.TRANSPORT ?? "http";
if (transport === "http") {
  runHTTP().catch((error: unknown) => {
    console.error("Server error:", error);
    process.exit(1);
  });
} else {
  runStdio().catch((error: unknown) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}

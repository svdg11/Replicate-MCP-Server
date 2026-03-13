"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const express_1 = require("express");
const express = express_1.default || express_1;
const replicate_js_1 = require("./services/replicate.js");
const predictions_js_1 = require("./tools/predictions.js");

const API_KEY = process.env.REPLICATE_API_TOKEN;
if (!API_KEY) {
  console.error("Error: REPLICATE_API_TOKEN environment variable is required");
  process.exit(1);
}

const client = new replicate_js_1.ReplicateClient(API_KEY);

function createServer() {
  const server = new mcp_js_1.McpServer({ name: "replicate-mcp-server", version: "1.0.0" });
  (0, predictions_js_1.registerTools)(server, client);
  return server;
}

async function runHTTP() {
  const app = express();
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    const server = createServer();
    const transport = new streamableHttp_js_1.StreamableHTTPServerTransport({
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

async function runStdio() {
  const server = createServer();
  const transport = new stdio_js_1.StdioServerTransport();
  await server.connect(transport);
  console.error("Replicate MCP server running on stdio");
}

const transport = process.env.TRANSPORT ?? "http";
if (transport === "http") {
  runHTTP().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
} else {
  runStdio().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}

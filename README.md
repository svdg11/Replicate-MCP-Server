# Replicate MCP Server

MCP server for Replicate image generation API. Gives Claude direct access to run Replicate models synchronously and get image URLs back in one call.

## Tools

| Tool | Description |
|------|-------------|
| `replicate_run_model` | Submit a prediction and wait for the result (synchronous via `Prefer: wait`) |
| `replicate_get_prediction` | Check the status of an existing prediction by ID |
| `replicate_cancel_prediction` | Cancel an in-progress prediction |

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Set environment variable

```bash
export REPLICATE_API_TOKEN=your_token_here
```

Get your token at: https://replicate.com/account/api-tokens

### 4. Run

```bash
# HTTP mode (default) — for remote hosting
npm start

# stdio mode — for local Claude Desktop integration
TRANSPORT=stdio npm start
```

## Hosting on Railway (recommended)

1. Push this repo to GitHub
2. Create a new Railway project → Deploy from GitHub repo
3. Add environment variable: `REPLICATE_API_TOKEN=your_token`
4. Railway auto-deploys and gives you a public URL like `https://replicate-mcp-server-production.up.railway.app`
5. Your MCP endpoint is: `https://your-railway-url/mcp`

## Connecting to Claude.ai

1. Go to Claude.ai → Settings → Connectors
2. Add custom connector
3. MCP URL: `https://your-railway-url/mcp`
4. Save — Claude will now have access to `replicate_run_model` and friends

## Usage example

Once connected, Claude can run:

```
replicate_run_model(
  model="google/nano-banana-2",
  prompt="Medium shot, woman in her 30s...",
  aspect_ratio="4:5",
  output_format="jpg"
)
```

Returns the image URL directly — no polling, no waiting.

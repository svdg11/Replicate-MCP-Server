"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTools = registerTools;

const zod_1 = require("zod");
const replicate_js_1 = require("../services/replicate.js");

function registerTools(server, client) {

  server.registerTool(
    "replicate_run_model",
    {
      title: "Run Replicate Model",
      description: `Submit a prediction to a Replicate model and wait synchronously for the result.

Uses the Prefer: wait header so the call blocks until the image is ready — no polling needed.
Returns the output image URL(s) directly.

Args:
  - model (string): Model in "owner/name" format, e.g. "google/nano-banana-2"
  - prompt (string): The image generation prompt
  - aspect_ratio (string, optional): "1:1", "4:5", "9:16", "16:9", "2:3". Defaults to "1:1"
  - output_format (string, optional): "jpg" or "png". Defaults to "jpg"
  - output_quality (number, optional): 1-100. Defaults to 90
  - extra_inputs (object, optional): Any additional model-specific input parameters

Returns:
  { prediction_id, status, output_urls, primary_url, model, predict_time_seconds }`,
      inputSchema: zod_1.z.object({
        model: zod_1.z.string().describe('Model in "owner/name" format, e.g. "google/nano-banana-2"'),
        prompt: zod_1.z.string().min(1).max(4000).describe("Image generation prompt"),
        aspect_ratio: zod_1.z.enum(["1:1", "4:5", "9:16", "16:9", "2:3", "3:2", "21:9"]).default("1:1").describe("Output aspect ratio"),
        output_format: zod_1.z.enum(["jpg", "png"]).default("jpg").describe("Output image format"),
        output_quality: zod_1.z.number().int().min(1).max(100).default(90).describe("Output quality 1-100"),
        extra_inputs: zod_1.z.record(zod_1.z.unknown()).optional().describe("Additional model-specific input parameters"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ model, prompt, aspect_ratio, output_format, output_quality, extra_inputs }) => {
      const input = { prompt, aspect_ratio, output_format, output_quality, ...extra_inputs };
      const prediction = await client.runModel(model, input);
      const outputUrls = (0, replicate_js_1.extractOutputUrls)(prediction);
      if (prediction.status === "failed") {
        const result = { prediction_id: prediction.id, status: "failed", error: prediction.error ?? "Unknown error", model };
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result };
      }
      const result = {
        prediction_id: prediction.id,
        status: prediction.status,
        output_urls: outputUrls,
        primary_url: outputUrls[0] ?? null,
        model,
        predict_time_seconds: prediction.metrics?.predict_time ?? null,
      };
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result };
    }
  );

  server.registerTool(
    "replicate_get_prediction",
    {
      title: "Get Prediction Status",
      description: `Check the status and output of an existing Replicate prediction by ID.

Args:
  - prediction_id (string): The prediction ID returned by replicate_run_model

Returns:
  { prediction_id, status, output_urls, primary_url, error, predict_time_seconds }`,
      inputSchema: zod_1.z.object({
        prediction_id: zod_1.z.string().describe("The prediction ID to look up"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ prediction_id }) => {
      const prediction = await client.getPrediction(prediction_id);
      const outputUrls = (0, replicate_js_1.extractOutputUrls)(prediction);
      const result = {
        prediction_id: prediction.id,
        status: prediction.status,
        output_urls: outputUrls,
        primary_url: outputUrls[0] ?? null,
        error: prediction.error ?? null,
        predict_time_seconds: prediction.metrics?.predict_time ?? null,
      };
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result };
    }
  );

  server.registerTool(
    "replicate_cancel_prediction",
    {
      title: "Cancel Prediction",
      description: `Cancel an in-progress Replicate prediction.

Args:
  - prediction_id (string): The prediction ID to cancel

Returns:
  { prediction_id, status, cancelled }`,
      inputSchema: zod_1.z.object({
        prediction_id: zod_1.z.string().describe("The prediction ID to cancel"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ prediction_id }) => {
      const prediction = await client.cancelPrediction(prediction_id);
      const result = { prediction_id: prediction.id, status: prediction.status, cancelled: prediction.status === "canceled" };
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result };
    }
  );
}

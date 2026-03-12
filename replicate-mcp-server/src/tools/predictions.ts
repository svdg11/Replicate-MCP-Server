import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  ReplicateClient,
  PredictionInput,
  extractOutputUrls,
} from "../services/replicate.js";

export function registerTools(server: McpServer, client: ReplicateClient): void {

  // ─── replicate_run_model ───────────────────────────────────────────────────

  server.registerTool(
    "replicate_run_model",
    {
      title: "Run Replicate Model",
      description: `Submit a prediction to a Replicate model and wait synchronously for the result.

Uses the Prefer: wait header so the call blocks until the image is ready — no polling needed.
Returns the output image URL(s) directly.

Designed for use with image generation models like google/nano-banana-2.

Args:
  - model (string): Model in "owner/name" format, e.g. "google/nano-banana-2"
  - prompt (string): The image generation prompt
  - aspect_ratio (string, optional): e.g. "1:1", "4:5", "9:16", "16:9". Defaults to "1:1"
  - output_format (string, optional): "jpg" or "png". Defaults to "jpg"
  - output_quality (number, optional): 1-100. Defaults to 90
  - extra_inputs (object, optional): Any additional model-specific input parameters

Returns:
  {
    "prediction_id": string,       // Replicate prediction ID
    "status": "succeeded"|"failed",
    "output_urls": string[],       // Array of generated image URLs
    "primary_url": string,         // First/primary output URL (use this for single image)
    "model": string,               // Model used
    "predict_time_seconds": number // How long generation took
  }

Examples:
  - Generate a 4:5 ad image: model="google/nano-banana-2", prompt="...", aspect_ratio="4:5"
  - Generate a square image: model="google/nano-banana-2", prompt="...", aspect_ratio="1:1"

Error handling:
  - Returns error details if prediction fails or model is unavailable
  - Times out after ~60s if model doesn't respond (Replicate's server-side limit)`,

      inputSchema: z.object({
        model: z
          .string()
          .describe('Model in "owner/name" format, e.g. "google/nano-banana-2"'),
        prompt: z.string().min(1).max(4000).describe("Image generation prompt"),
        aspect_ratio: z
          .enum(["1:1", "4:5", "9:16", "16:9", "2:3", "3:2", "21:9"])
          .default("1:1")
          .describe("Output aspect ratio"),
        output_format: z
          .enum(["jpg", "png"])
          .default("jpg")
          .describe("Output image format"),
        output_quality: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(90)
          .describe("Output quality 1-100"),
        extra_inputs: z
          .record(z.unknown())
          .optional()
          .describe("Additional model-specific input parameters"),
      }),

      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },

    async ({ model, prompt, aspect_ratio, output_format, output_quality, extra_inputs }) => {
      const input: PredictionInput = {
        prompt,
        aspect_ratio,
        output_format,
        output_quality,
        ...extra_inputs,
      };

      const prediction = await client.runModel(model, input);
      const outputUrls = extractOutputUrls(prediction);

      if (prediction.status === "failed") {
        const result = {
          prediction_id: prediction.id,
          status: "failed",
          error: prediction.error ?? "Unknown error",
          model,
        };
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      }

      const result = {
        prediction_id: prediction.id,
        status: prediction.status,
        output_urls: outputUrls,
        primary_url: outputUrls[0] ?? null,
        model,
        predict_time_seconds: prediction.metrics?.predict_time ?? null,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }
  );

  // ─── replicate_get_prediction ──────────────────────────────────────────────

  server.registerTool(
    "replicate_get_prediction",
    {
      title: "Get Prediction Status",
      description: `Check the status and output of an existing Replicate prediction by ID.

Useful if a replicate_run_model call timed out and you need to check if it completed.

Args:
  - prediction_id (string): The prediction ID returned by replicate_run_model

Returns:
  {
    "prediction_id": string,
    "status": "starting"|"processing"|"succeeded"|"failed"|"canceled",
    "output_urls": string[],
    "primary_url": string | null,
    "error": string | null,
    "predict_time_seconds": number | null
  }`,

      inputSchema: z.object({
        prediction_id: z
          .string()
          .describe("The prediction ID to look up"),
      }),

      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },

    async ({ prediction_id }) => {
      const prediction = await client.getPrediction(prediction_id);
      const outputUrls = extractOutputUrls(prediction);

      const result = {
        prediction_id: prediction.id,
        status: prediction.status,
        output_urls: outputUrls,
        primary_url: outputUrls[0] ?? null,
        error: prediction.error ?? null,
        predict_time_seconds: prediction.metrics?.predict_time ?? null,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }
  );

  // ─── replicate_cancel_prediction ──────────────────────────────────────────

  server.registerTool(
    "replicate_cancel_prediction",
    {
      title: "Cancel Prediction",
      description: `Cancel an in-progress Replicate prediction.

Use this if a job is taking too long or was submitted by mistake.

Args:
  - prediction_id (string): The prediction ID to cancel

Returns:
  { "prediction_id": string, "status": string, "cancelled": boolean }`,

      inputSchema: z.object({
        prediction_id: z
          .string()
          .describe("The prediction ID to cancel"),
      }),

      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },

    async ({ prediction_id }) => {
      const prediction = await client.cancelPrediction(prediction_id);

      const result = {
        prediction_id: prediction.id,
        status: prediction.status,
        cancelled: prediction.status === "canceled",
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }
  );
}

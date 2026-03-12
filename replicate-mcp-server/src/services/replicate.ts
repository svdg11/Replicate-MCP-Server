const REPLICATE_API_BASE = "https://api.replicate.com/v1";

export interface PredictionInput {
  prompt: string;
  aspect_ratio?: string;
  output_format?: string;
  output_quality?: number;
  [key: string]: unknown;
}

export interface Prediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: string[] | string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
  urls: {
    get: string;
    cancel: string;
  };
  model?: string;
  version?: string | null;
  input: PredictionInput;
  metrics?: {
    predict_time?: number;
  };
}

export class ReplicateClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(
    path: string,
    method: string,
    body?: unknown,
    extraHeaders?: Record<string, string>
  ): Promise<T> {
    const url = `${REPLICATE_API_BASE}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Replicate API error ${response.status}: ${errorText}`
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Run a model synchronously using Prefer: wait header.
   * Blocks until the prediction completes (or times out at Replicate's end).
   */
  async runModel(
    model: string,
    input: PredictionInput
  ): Promise<Prediction> {
    // model format: "owner/name" e.g. "google/nano-banana-2"
    const path = `/models/${model}/predictions`;
    return this.request<Prediction>(
      path,
      "POST",
      { input },
      { Prefer: "wait" }
    );
  }

  /**
   * Get the status of an existing prediction by ID.
   */
  async getPrediction(predictionId: string): Promise<Prediction> {
    return this.request<Prediction>(`/predictions/${predictionId}`, "GET");
  }

  /**
   * Cancel an in-progress prediction.
   */
  async cancelPrediction(predictionId: string): Promise<Prediction> {
    return this.request<Prediction>(
      `/predictions/${predictionId}/cancel`,
      "POST"
    );
  }
}

/**
 * Extract the output URL(s) from a completed prediction.
 * Returns an array of URLs regardless of whether output is string or string[].
 */
export function extractOutputUrls(prediction: Prediction): string[] {
  if (!prediction.output) return [];
  if (Array.isArray(prediction.output)) return prediction.output;
  return [prediction.output];
}

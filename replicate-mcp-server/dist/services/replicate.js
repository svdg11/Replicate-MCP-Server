"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReplicateClient = void 0;
exports.extractOutputUrls = extractOutputUrls;

const REPLICATE_API_BASE = "https://api.replicate.com/v1";

class ReplicateClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async request(path, method, body, extraHeaders = {}) {
    const url = `${REPLICATE_API_BASE}${path}`;
    const headers = {
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
      throw new Error(`Replicate API error ${response.status}: ${errorText}`);
    }
    return response.json();
  }

  async runModel(model, input) {
    const path = `/models/${model}/predictions`;
    return this.request(path, "POST", { input }, { Prefer: "wait" });
  }

  async getPrediction(predictionId) {
    return this.request(`/predictions/${predictionId}`, "GET");
  }

  async cancelPrediction(predictionId) {
    return this.request(`/predictions/${predictionId}/cancel`, "POST");
  }
}
exports.ReplicateClient = ReplicateClient;

function extractOutputUrls(prediction) {
  if (!prediction.output) return [];
  if (Array.isArray(prediction.output)) return prediction.output;
  return [prediction.output];
}

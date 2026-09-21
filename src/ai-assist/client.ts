import { GoogleGenerativeAI } from "@google/generative-ai";

// Free-tier Gemini Flash model. Worth double-checking this name is still
// current at https://ai.google.dev/gemini-api/docs/models before relying on it.
const MODEL_NAME = "gemini-3.5-flash-lite";

// Thrown when AI-assist is invoked but no API key is configured.
// Callers should catch this and gracefully skip the AI step, never crash.
export class AiAssistDisabledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiAssistDisabledError";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Gemini request timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export async function callGemini<T>({
  prompt,
  responseSchema,
  timeoutMs = 15000,
}: {
  prompt: string;
  responseSchema: object;
  timeoutMs?: number;
}): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiAssistDisabledError(
      "GEMINI_API_KEY is not set — AI-assist features are unavailable. " +
      "Set it with: export GEMINI_API_KEY=your-key-here"
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema as any, // Gemini SDK's Schema type is a closed union; ours comes from Zod, so this boundary is an intentional escape hatch
    },
  });

  const result = await withTimeout(model.generateContent(prompt), timeoutMs);
  const text = result.response.text();

  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 200)}...`);
  }
}
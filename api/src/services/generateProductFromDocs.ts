/**
 * Generate Product from Documentation Service
 *
 * Uses OpenAI to analyze product/feature documentation and generate
 * a structured Product with value points (listen_for + insight_text).
 */

import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!OPENAI_API_KEY) {
    throw new Error(
      "Missing OpenAI API key. Set OPENAI_API_KEY environment variable."
    );
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });
  }

  return openaiClient;
}

export interface GeneratedValuePoint {
  listen_for: string;
  insight_text: string;
  link?: string;
}

export interface GeneratedProduct {
  title: string;
  description: string;
  value_points: GeneratedValuePoint[];
}

/**
 * Analyze product/feature documentation and generate a structured Product
 * with value points that can be used for sales call coaching.
 */
export async function generateProductFromDocs(
  content: string
): Promise<GeneratedProduct> {
  const client = getOpenAIClient();

  const systemMessage = `You are a product marketing analyst. Your job is to read product or feature documentation and generate a structured product profile for a sales coaching tool.

The sales coaching tool works like this: after a sales call, an AI evaluates the call transcript against "value points." Each value point has:
- "listen_for": A condition or scenario that a prospect might describe on a sales call (e.g. "The prospect mentions struggling with patient data interoperability across systems")
- "insight_text": The insight to surface to the account executive — what the product/feature does to address that scenario (e.g. "Our FHIR-based integration engine connects to 300+ EHR systems out of the box, enabling real-time patient data exchange without custom HL7 mapping")
- "link" (optional): A URL from the documentation that provides more detail on this capability

Given the documentation below, extract:
1. "title": The product or feature name (short, clear)
2. "description": A 1-2 sentence summary of what the product/feature does
3. "value_points": An array of 3-10 value points. Each should represent a distinct capability, use case, or differentiator from the documentation. Write "listen_for" as a realistic scenario a prospect would describe on a sales call. Write "insight_text" as a concise explanation of what the product does to address that scenario — use ONLY information from the documentation, do not invent features. If the documentation contains relevant URLs, include them as "link".

Focus on the most impactful and distinct value points. Avoid redundancy. Write in a professional but conversational tone.

Return a JSON object with keys: "title", "description", "value_points" (array of objects with "listen_for", "insight_text", and optionally "link").`;

  console.log(
    `[OpenAI] Generating product from documentation (${content.length} chars)`
  );

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemMessage },
      {
        role: "user",
        content: `## Product Documentation\n\n${content}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 4000,
    response_format: { type: "json_object" },
  });

  const responseContent = completion.choices[0]?.message?.content;
  if (!responseContent) {
    throw new Error(
      "OpenAI returned an empty response for product generation"
    );
  }

  const parsed = JSON.parse(responseContent) as GeneratedProduct;

  // Validate the response structure
  if (!parsed.title || typeof parsed.title !== "string") {
    throw new Error("Generated product is missing a valid title");
  }
  if (!Array.isArray(parsed.value_points)) {
    throw new Error("Generated product is missing value_points array");
  }

  // Clean up value points — filter out any that are missing required fields
  parsed.value_points = parsed.value_points.filter(
    (vp) =>
      typeof vp.listen_for === "string" &&
      vp.listen_for.trim().length > 0 &&
      typeof vp.insight_text === "string" &&
      vp.insight_text.trim().length > 0
  );

  console.log(
    `[OpenAI] Generated product "${parsed.title}" with ${parsed.value_points.length} value points`
  );

  return parsed;
}

/**
 * OpenAI Coaching Service
 * 
 * Generates coaching feedback for sales calls using OpenAI GPT-4.
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

export interface ProductValuePointInput {
  productTitle: string;
  productDescription?: string;
  valuePoints: { listen_for: string; insight_text: string; link?: string }[];
}

export interface CoachingInput {
  transcript: string;
  call_title?: string;
  call_date?: string;
  ae_email?: string;
  external_emails?: string[];
  external_speaker_names?: string[];
  company_context?: string;
  product_value_points?: ProductValuePointInput[];
}

export interface CoachingOutput {
  subject: string;
  body: string;
}

/**
 * Generate coaching feedback using OpenAI GPT-4
 */
export async function generateCoachingFeedback(
  input: CoachingInput
): Promise<CoachingOutput> {
  const client = getOpenAIClient();
  
  const { transcript, call_title, call_date, ae_email, external_emails, external_speaker_names, company_context, product_value_points } = input;
  
  // Build call metadata for context
  let callMeta = "";
  if (call_title) callMeta += `Call Title: ${call_title}\n`;
  if (call_date) callMeta += `Call Date: ${call_date}\n`;
  if (ae_email) callMeta += `AE Email: ${ae_email}\n`;
  if (external_emails && external_emails.length > 0) {
    callMeta += `External Participant Emails: ${external_emails.join(", ")}\n`;
  }
  if (external_speaker_names && external_speaker_names.length > 0) {
    callMeta += `External Participant Names: ${external_speaker_names.join(", ")}\n`;
  }

  // Build product catalogue for the system prompt
  let productCatalogue = "";
  if (product_value_points && product_value_points.length > 0) {
    productCatalogue = "\n\n## Products & Value Points\n\n";
    for (const product of product_value_points) {
      if (product.valuePoints.length === 0) continue;
      productCatalogue += `### ${product.productTitle}\n`;
      if (product.productDescription) {
        productCatalogue += `${product.productDescription}\n`;
      }
      for (const vp of product.valuePoints) {
        productCatalogue += `- CONDITION: ${vp.listen_for}\n  INSIGHT: ${vp.insight_text}\n`;
        if (vp.link) {
          productCatalogue += `  LINK: ${vp.link}\n`;
        }
      }
      productCatalogue += "\n";
    }
  }

  // System message: prescribes exact output structure
  const systemMessage = `You are an expert sales coach providing feedback to account executives after their sales calls. Your feedback should be constructive, specific, and actionable.

Structure your email output EXACTLY as follows:

## 1. Prospect Overview
Begin with a 2-3 sentence description of the prospect's business. Use the "Prospect Company Context" provided in the call context to write this. Tailor it to what is relevant for the sales conversation.

## 2. Product Coaching
Below is a list of products, each with value points. Each value point has a CONDITION and an INSIGHT.

For each value point:
  1. Check whether the CONDITION is true based on the call transcript and/or the prospect's business context.
  2. If the CONDITION is true, include a coaching bullet point under that product's title in the email. Use the INSIGHT as the basis for the bullet, adapted to the specific prospect and what was discussed on the call.
  3. If the CONDITION is NOT true for a value point, do NOT include it.
  4. If a triggered value point has a LINK, include "Learn More: <url>" immediately after the coaching bullet so the reader can access the resource.

Only include a product heading in the email if at least one of its value points triggered. If none of a product's value points triggered, omit that product entirely.

IMPORTANT: Include a MAXIMUM of 3 products in the email. If more than 3 products have triggered value points, select the 3 most relevant to the call and prospect context and omit the rest. If 3 or fewer triggered, include all that triggered.

Keep the tone professional, concise, and actionable. Do not add sections beyond the prospect overview and the triggered product sections.
${productCatalogue}`;

  // User message: call context + transcript
  let userContext = "";
  if (callMeta) userContext += `## Call Metadata\n${callMeta}\n`;
  if (company_context) userContext += `## Prospect Company Context\n${company_context}\n\n`;

  const userMessage = `${userContext}## Call Transcript
${transcript}

Analyze this call and provide coaching feedback following the structure described in your instructions.`;

  console.log(`[OpenAI] Generating coaching feedback for call: ${call_title || "Unknown"}`);

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 2000,
  });

  const responseContent = completion.choices[0]?.message?.content;
  
  if (!responseContent) {
    throw new Error("OpenAI returned an empty response");
  }

  // Generate a subject line based on the call
  const subjectCompletion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { 
        role: "system", 
        content: "Generate a short, professional email subject line (max 60 chars) for coaching feedback. Just return the subject line, nothing else." 
      },
      { 
        role: "user", 
        content: `Call title: ${call_title || "Sales Call"}\nAE: ${ae_email || "Unknown"}\n\nGenerate a subject line for coaching feedback about this call.` 
      },
    ],
    temperature: 0.5,
    max_tokens: 50,
  });

  const subject = subjectCompletion.choices[0]?.message?.content?.trim() || "Your Coaching Feedback";

  return {
    subject,
    body: responseContent,
  };
}

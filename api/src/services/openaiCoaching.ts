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
  valuePoints: { listen_for: string; insight_text: string }[];
}

export interface CoachingInput {
  prompt: string;
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
  
  const { prompt, transcript, call_title, call_date, ae_email, external_emails, external_speaker_names, company_context, product_value_points } = input;
  
  // Build context for the AI
  let contextInfo = "";
  if (call_title) {
    contextInfo += `Call Title: ${call_title}\n`;
  }
  if (call_date) {
    contextInfo += `Call Date: ${call_date}\n`;
  }
  if (ae_email) {
    contextInfo += `AE Email: ${ae_email}\n`;
  }
  if (external_emails && external_emails.length > 0) {
    contextInfo += `External Participants: ${external_emails.join(", ")}\n`;
  }
  if (external_speaker_names && external_speaker_names.length > 0) {
    contextInfo += `External participants on this call (by name): ${external_speaker_names.join(", ")}. When something they say relates to a value point below, include the corresponding insight in your feedback.\n`;
  }
  if (company_context) {
    contextInfo += `\n## Prospect Company Context\n${company_context}\n`;
  }
  
  // Build product value points section for the prompt
  let productValuePointsBlock = "";
  if (product_value_points && product_value_points.length > 0) {
    productValuePointsBlock = "\n\n## Product value points\n";
    productValuePointsBlock += "For each product below, listen for the described topics on the call. If an external participant says something related to a value point, include the corresponding insight in your coaching email.\n\n";
    for (const product of product_value_points) {
      if (product.valuePoints.length === 0) continue;
      productValuePointsBlock += `### ${product.productTitle}\n`;
      if (product.productDescription) {
        productValuePointsBlock += `${product.productDescription}\n\n`;
      }
      for (const vp of product.valuePoints) {
        productValuePointsBlock += `- Listen for: ${vp.listen_for}. If an external participant says something related, include this insight in the email: ${vp.insight_text}\n`;
      }
      productValuePointsBlock += "\n";
    }
  }
  
  const systemMessage = `You are an expert sales coach providing feedback to account executives based on their sales calls. 
Your feedback should be constructive, specific, and actionable.

${prompt}${productValuePointsBlock}`;

  const userMessage = `${contextInfo ? `## Call Context\n${contextInfo}\n` : ""}## Call Transcript
${transcript}

Please analyze this call and provide coaching feedback.`;

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

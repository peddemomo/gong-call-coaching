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

export interface CoachingInput {
  prompt: string;
  transcript: string;
  call_title?: string;
  call_date?: string;
  ae_email?: string;
  external_emails?: string[];
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
  
  const { prompt, transcript, call_title, call_date, ae_email, external_emails } = input;
  
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
  
  const systemMessage = `You are an expert sales coach providing feedback to account executives based on their sales calls. 
Your feedback should be constructive, specific, and actionable.

${prompt}`;

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

/**
 * Call Eligibility Classifier
 * 
 * Determines whether a call should receive coaching feedback.
 * Uses OpenAI GPT-4 to classify calls as PROSPECT vs INTERNAL/CUSTOMER calls.
 * Only PROSPECT calls (external, pre-sale sales calls) should receive coaching.
 */

import OpenAI from "openai";

export type CallType = 
  | "prospect"
  | "existing_customer"
  | "internal"
  | "unknown";

export interface ClassifierInput {
  call_title?: string;
  external_emails?: string[];
  transcript?: string;
}

export interface ClassifierDecision {
  should_send: boolean;
  call_type: CallType;
  confidence: number;
  reason: string;
  is_prospect_call: boolean;
}

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

const CLASSIFICATION_PROMPT = `You are a classifier that determines whether a call is a PROSPECT CALL or an INTERNAL CALL.

Definitions:

PROSPECT CALL = an EXTERNAL, PRE-SALE sales call for AcuityMD.
Mark as prospect ONLY if the people from the other company are not already customers AND the call includes sales motion such as:
- discovery to buy AcuityMD, demo of AcuityMD, pricing/budget for AcuityMD, qualification, procurement, decision process, or explicit next steps to purchase AcuityMD.

NOT a prospect call if there is evidence they are ALREADY a customer, such as:
- they state they use AcuityMD or reference an active AcuityMD account
- discussion is about product feedback, renewal, support, QBRs, or improving an existing workflow in AcuityMD
- no evaluation or buying process for AcuityMD is discussed

INTERNAL CALL = any call ONLY between AcuityMD employees (managers, pipeline reviews, trainings, strategy, etc).

Classification rules (in order):
1) If all participants are AcuityMD employees → INTERNAL CALL.
2) Else if there is clear evidence they are an existing AcuityMD customer → NOT PROSPECT (set is_prospect_call=false).
3) Else if it is an external pre-sale sales motion for AcuityMD → PROSPECT CALL.
4) Otherwise → NOT PROSPECT.

Return ONLY valid JSON in this exact structure:

{
  "is_prospect_call": true or false,
  "reason": "short explanation"
}`;

interface AIClassificationResult {
  is_prospect_call: boolean;
  reason: string;
}

/**
 * Classify whether a call is eligible for coaching email generation using AI.
 * Only PROSPECT calls (external, pre-sale sales calls) should receive coaching.
 * 
 * @param input - Call metadata including title, external emails, and transcript
 * @returns Classification decision with reasoning
 */
export async function classifyCallEligibility(input: ClassifierInput): Promise<ClassifierDecision> {
  const { call_title, external_emails, transcript } = input;
  
  const hasExternalEmails = external_emails && external_emails.length > 0;

  // Quick check: No external emails -> definitely internal
  if (!hasExternalEmails) {
    return {
      should_send: false,
      call_type: "internal",
      confidence: 0.95,
      reason: "No external participants detected - this is an internal call",
      is_prospect_call: false,
    };
  }

  // Quick check: No transcript -> can't classify properly
  if (!transcript) {
    return {
      should_send: false,
      call_type: "unknown",
      confidence: 0.5,
      reason: "No transcript available - cannot determine if this is a prospect call",
      is_prospect_call: false,
    };
  }

  // Use AI to classify the call
  try {
    const client = getOpenAIClient();

    // Build context for classification
    let contextInfo = "";
    if (call_title) {
      contextInfo += `Call Title: ${call_title}\n`;
    }
    if (external_emails && external_emails.length > 0) {
      contextInfo += `External Participants: ${external_emails.join(", ")}\n`;
    }

    const userMessage = `${contextInfo}\nTranscript:\n${transcript}`;

    console.log(`[Classifier] Classifying call: ${call_title || "Unknown"}`);

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini", // Use mini for faster/cheaper classification
      messages: [
        { role: "system", content: CLASSIFICATION_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.1, // Low temperature for consistent classification
      max_tokens: 200,
    });

    const responseContent = completion.choices[0]?.message?.content;
    
    if (!responseContent) {
      throw new Error("OpenAI returned an empty response");
    }

    // Parse the JSON response
    let classificationResult: AIClassificationResult;
    try {
      // Clean the response (remove markdown code blocks if present)
      let cleanedResponse = responseContent.trim();
      if (cleanedResponse.startsWith("```json")) {
        cleanedResponse = cleanedResponse.slice(7);
      }
      if (cleanedResponse.startsWith("```")) {
        cleanedResponse = cleanedResponse.slice(3);
      }
      if (cleanedResponse.endsWith("```")) {
        cleanedResponse = cleanedResponse.slice(0, -3);
      }
      cleanedResponse = cleanedResponse.trim();
      
      classificationResult = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error("[Classifier] Failed to parse AI response:", responseContent);
      throw new Error(`Failed to parse classification response: ${responseContent}`);
    }

    console.log(`[Classifier] Result: is_prospect_call=${classificationResult.is_prospect_call}, reason="${classificationResult.reason}"`);

    // Determine call type based on classification
    let callType: CallType = "unknown";
    if (classificationResult.is_prospect_call) {
      callType = "prospect";
    } else if (classificationResult.reason.toLowerCase().includes("internal")) {
      callType = "internal";
    } else if (classificationResult.reason.toLowerCase().includes("customer") || 
               classificationResult.reason.toLowerCase().includes("existing")) {
      callType = "existing_customer";
    }

    return {
      should_send: classificationResult.is_prospect_call,
      call_type: callType,
      confidence: 0.9, // AI classification has high confidence
      reason: classificationResult.reason,
      is_prospect_call: classificationResult.is_prospect_call,
    };

  } catch (error) {
    console.error("[Classifier] AI classification failed:", error);
    
    // Fallback: Don't send if we can't classify
    return {
      should_send: false,
      call_type: "unknown",
      confidence: 0.3,
      reason: `Classification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      is_prospect_call: false,
    };
  }
}

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

export interface ValuePointEvaluation {
  productTitle: string;
  listen_for: string;
  insight_text: string;
  link?: string;
  triggered: boolean;
  evidence: string;  // quote/paraphrase from transcript when triggered
  reasoning: string; // why condition was/wasn't met
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
  evaluations?: ValuePointEvaluation[];
}

export interface CoachingOutput {
  subject: string;
  body: string;
}

/**
 * Evaluate value points against a call transcript.
 * Returns structured JSON with triggered/not-triggered status, evidence, and reasoning.
 */
export async function evaluateValuePoints(
  transcript: string,
  companyContext: string | undefined,
  productValuePoints: ProductValuePointInput[],
): Promise<ValuePointEvaluation[]> {
  const client = getOpenAIClient();

  // Build a flat list of value points with product context for the prompt
  const valuePointsList: { index: number; productTitle: string; listen_for: string; insight_text: string; link?: string }[] = [];
  for (const product of productValuePoints) {
    for (const vp of product.valuePoints) {
      valuePointsList.push({
        index: valuePointsList.length,
        productTitle: product.productTitle,
        listen_for: vp.listen_for,
        insight_text: vp.insight_text,
        link: vp.link,
      });
    }
  }

  if (valuePointsList.length === 0) {
    return [];
  }

  // Build the value points section for the prompt
  let vpSection = "";
  for (const vp of valuePointsList) {
    vpSection += `[${vp.index}] Product: ${vp.productTitle}\n    CONDITION: ${vp.listen_for}\n\n`;
  }

  const systemMessage = `You are a precise analyst. Your job is to evaluate whether specific conditions are supported by evidence in a sales call transcript AND/OR the prospect's company context (research about the prospect's business).

IMPORTANT: Evidence can come from EITHER source:
- The call transcript (what was said on the call)
- The company context (facts about the prospect's business, products, industry, or recent activity)

A condition is triggered if EITHER source provides supporting evidence. For example, if a condition is about the prospect's product capabilities, and the company context describes those capabilities, that is sufficient evidence even if it was never mentioned on the call.

For each condition below, determine:
1. "triggered": Is the condition supported by the transcript or company context? Only mark as NOT triggered if neither source contains relevant evidence.
2. "evidence": If triggered, provide the supporting evidence — a brief quote or paraphrase from the transcript OR a relevant fact from the company context (1-2 sentences max). Prefix with "[Transcript]" or "[Company Context]" to indicate the source. If not triggered, leave as an empty string.
3. "reasoning": A brief explanation (1 sentence) of why the condition was or was not met.

Return a JSON object with a single key "evaluations" containing an array. Each element must have:
- "index": the value point index number
- "triggered": boolean
- "evidence": string
- "reasoning": string

The array must have exactly ${valuePointsList.length} elements, one per value point, in order.`;

  let userContent = "";
  if (companyContext) {
    userContent += `## Company Context\n${companyContext}\n\n`;
  }
  userContent += `## Call Transcript\n${transcript}\n\n`;
  userContent += `## Value Points to Evaluate\n${vpSection}`;

  console.log(`[OpenAI] Evaluating ${valuePointsList.length} value points against transcript`);

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: userContent },
    ],
    temperature: 0.1,
    max_tokens: 4000,
    response_format: { type: "json_object" },
  });

  const responseContent = completion.choices[0]?.message?.content;
  if (!responseContent) {
    throw new Error("OpenAI returned an empty response for value point evaluation");
  }

  const parsed = JSON.parse(responseContent) as {
    evaluations: { index: number; triggered: boolean; evidence: string; reasoning: string }[];
  };

  // Map the structured results back to full ValuePointEvaluation objects
  const evaluations: ValuePointEvaluation[] = valuePointsList.map((vp, i) => {
    const evalResult = parsed.evaluations.find((e) => e.index === i) || {
      triggered: false,
      evidence: "",
      reasoning: "No evaluation returned",
    };
    return {
      productTitle: vp.productTitle,
      listen_for: vp.listen_for,
      insight_text: vp.insight_text,
      link: vp.link,
      triggered: evalResult.triggered,
      evidence: evalResult.evidence || "",
      reasoning: evalResult.reasoning || "",
    };
  });

  const triggeredCount = evaluations.filter((e) => e.triggered).length;
  console.log(`[OpenAI] Value point evaluation complete: ${triggeredCount}/${evaluations.length} triggered`);

  return evaluations;
}

/**
 * Generate coaching feedback using OpenAI GPT-4
 */
export async function generateCoachingFeedback(
  input: CoachingInput
): Promise<CoachingOutput> {
  const client = getOpenAIClient();
  
  const { transcript, call_title, call_date, ae_email, external_emails, external_speaker_names, company_context, product_value_points, evaluations } = input;
  
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

  // Build the product section for the system prompt.
  // When pre-evaluated value points are provided, only include triggered ones with their evidence.
  // Otherwise, fall back to the full catalogue with CONDITIONS for the LLM to evaluate.
  let productSection = "";
  let productInstructions = "";

  if (evaluations && evaluations.length > 0) {
    // Pre-evaluated mode: only include triggered value points with evidence
    const triggered = evaluations.filter((e) => e.triggered);
    if (triggered.length > 0) {
      // Group by product, limit to 3 products
      const byProduct = new Map<string, ValuePointEvaluation[]>();
      for (const ev of triggered) {
        const existing = byProduct.get(ev.productTitle) || [];
        existing.push(ev);
        byProduct.set(ev.productTitle, existing);
      }

      // Take at most 3 products
      const productEntries = Array.from(byProduct.entries()).slice(0, 3);

      productSection = "\n\n## Triggered Value Points (with evidence from the call)\n\n";
      for (const [productTitle, vps] of productEntries) {
        productSection += `### ${productTitle}\n`;
        for (const vp of vps) {
          productSection += `- EVIDENCE: ${vp.evidence}\n  INSIGHT: ${vp.insight_text}\n`;
          if (vp.link) {
            productSection += `  LINK: ${vp.link}\n`;
          }
        }
        productSection += "\n";
      }

      productInstructions = `## Resources for your follow-up
Below are value points that have already been identified as relevant to this call. Each has EVIDENCE (a quote or fact from the call/company research that triggered it) and an INSIGHT (what our product does).

For each value point, write a bullet point under its product heading as ONE smooth paragraph — do NOT break it into labeled sections like "The connection:", "The problem:", "How this helps:". Just write it as natural, flowing prose.

The paragraph should weave together three things naturally:
  - Start by grounding in the evidence. Use the EVIDENCE directly — quote or closely paraphrase what was said on the call or what's known about the prospect's business. Be specific (e.g. "Mike mentioned needing to prove device usage to payers" not "the topic of reimbursement came up").
  - Connect it to the prospect's challenge — what's at stake, what's hard about this for them.
  - Then explain how our product helps, using ONLY what is stated in the INSIGHT text. You may rephrase the INSIGHT to fit the flow, but do NOT invent product features, capabilities, or details beyond what the INSIGHT says.
  - If a value point has a LINK, include "Learn More: <url>" at the end of the paragraph.

CRITICAL: When describing our product's capabilities, use ONLY what is stated in the INSIGHT text. Do NOT hallucinate or infer additional product features or functionality. It is better to be vague than to be wrong about what our product does.

Each bullet should be 2-4 sentences as a single flowing paragraph. Use specifics from the prospect's business and the evidence wherever possible.

Include all listed products and value points. Do not add or remove any.`;
    }
  } else if (product_value_points && product_value_points.length > 0) {
    // Fallback: full catalogue with CONDITIONS for the LLM to evaluate
    productSection = "\n\n## Products & Value Points\n\n";
    for (const product of product_value_points) {
      if (product.valuePoints.length === 0) continue;
      productSection += `### ${product.productTitle}\n`;
      if (product.productDescription) {
        productSection += `${product.productDescription}\n`;
      }
      for (const vp of product.valuePoints) {
        productSection += `- CONDITION: ${vp.listen_for}\n  INSIGHT: ${vp.insight_text}\n`;
        if (vp.link) {
          productSection += `  LINK: ${vp.link}\n`;
        }
      }
      productSection += "\n";
    }

    productInstructions = `## Resources for your follow-up
Below is a list of products, each with value points. Each value point has a CONDITION and an INSIGHT.

For each value point:
  1. Check whether the CONDITION is true based on the call transcript and/or the prospect's business context.
  2. If the CONDITION is true, include a bullet point under that product's heading. For each bullet, briefly reference the specific moment or topic from the call that makes this relevant (e.g. "When [name] mentioned struggling with X..."), then provide the INSIGHT adapted to the prospect's situation.
  3. If the CONDITION is NOT true for a value point, do NOT include it.
  4. If a triggered value point has a LINK, include "Learn More: <url>" immediately after the bullet so the reader can access the resource.

A single product can have multiple triggered value points — include a separate bullet for EACH one under that product's heading. Only include a product heading if at least one of its value points triggered. If none triggered, omit that product entirely.

IMPORTANT: Include a MAXIMUM of 3 products. If more than 3 have triggered value points, select the 3 most relevant to the call and omit the rest.`;
  }

  // System message: prescribes exact output structure
  const systemMessage = `You are a product intelligence assistant that helps account executives follow up on sales calls with the right resources. Your tone is helpful and brief — like a knowledgeable colleague pinging them after a call with a useful tip, not a manager reviewing their performance.

When referring to the prospect, use their first name (from "External Participant Names" in the call metadata). This makes the email feel personal and relevant.

Structure your email output EXACTLY as follows:

## Call recap
Write 1-2 sentences summarizing what the prospect cared about on this call. Reference something specific the prospect said or asked about — anchor this in the actual conversation, not generic company info. Use the prospect's first name.

${productInstructions}

Keep the entire email under 400 words. Be specific and substantive, but don't pad with filler. Do not add any sections beyond the call recap and the product sections.
${productSection}`;

  // User message: call context + transcript
  let userContext = "";
  if (callMeta) userContext += `## Call Metadata\n${callMeta}\n`;
  if (company_context) userContext += `## Prospect Company Context\n${company_context}\n\n`;

  const userMessage = `${userContext}## Call Transcript
${transcript}

Analyze this call and generate a concise product intel email following the structure described in your instructions.`;

  console.log(`[OpenAI] Generating product intel email for call: ${call_title || "Unknown"}`);

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: userMessage },
    ],
    temperature: 0.4,
    max_tokens: 2000,
  });

  const responseContent = completion.choices[0]?.message?.content;
  
  if (!responseContent) {
    throw new Error("OpenAI returned an empty response");
  }

  // Generate a subject line based on the call, prospect, and email content
  const prospectNames = external_speaker_names?.join(", ") || "";
  const prospectEmails = external_emails?.join(", ") || "";

  const subjectCompletion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { 
        role: "system", 
        content: `Generate a short email subject line (max 50 chars) for a post-call product intel email. The subject should reference the prospect's company or name and hint at what resource is relevant. Do NOT use the words "coaching" or "feedback." Do NOT use quotation marks. Just return the subject line text, nothing else.

Examples of good subject lines:
- Acme call — cloud migration resources
- Follow-up intel: Sarah's compliance concerns
- For your Initech call — 2 relevant case studies` 
      },
      { 
        role: "user", 
        content: `Call title: ${call_title || "Sales Call"}\nProspect names: ${prospectNames || "Unknown"}\nProspect emails: ${prospectEmails || "Unknown"}\n\nEmail body summary:\n${responseContent.substring(0, 500)}\n\nGenerate a subject line for this post-call intel email.` 
      },
    ],
    temperature: 0.5,
    max_tokens: 50,
  });

  const subject = subjectCompletion.choices[0]?.message?.content?.trim().replace(/^["']|["']$/g, "") || "Post-call intel for your review";

  return {
    subject,
    body: responseContent,
  };
}

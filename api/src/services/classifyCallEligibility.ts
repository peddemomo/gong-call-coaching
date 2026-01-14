/**
 * Call Eligibility Classifier
 * 
 * Determines whether a call should receive coaching feedback.
 * Currently implements placeholder rules-based logic.
 * Will be replaced with OpenAI-powered classification later.
 */

export type CallType = 
  | "new_business"
  | "expansion"
  | "renewal"
  | "support"
  | "internal"
  | "partner"
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
}

// Keywords that indicate internal/non-sales calls
const INTERNAL_KEYWORDS = [
  "internal",
  "standup",
  "stand-up",
  "interview",
  "1:1",
  "one on one",
  "team meeting",
  "all hands",
  "sync",
  "retro",
  "retrospective",
  "planning",
  "sprint",
];

// Keywords that indicate new business / sales conversations
const NEW_BUSINESS_KEYWORDS = [
  "pricing",
  "proposal",
  "demo",
  "demonstration",
  "next steps",
  "contract",
  "pilot",
  "trial",
  "poc",
  "proof of concept",
  "budget",
  "decision maker",
  "timeline",
  "implementation",
  "onboarding",
  "roi",
  "return on investment",
  "competitor",
  "comparison",
  "evaluation",
  "requirements",
];

/**
 * Classify whether a call is eligible for coaching email generation.
 * 
 * This is a placeholder implementation using simple rules.
 * Will be replaced with OpenAI-powered classification.
 * 
 * @param input - Call metadata including title, external emails, and transcript
 * @returns Classification decision with reasoning
 */
export function classifyCallEligibility(input: ClassifierInput): ClassifierDecision {
  const { call_title, external_emails, transcript } = input;
  
  const titleLower = (call_title || "").toLowerCase();
  const transcriptLower = (transcript || "").toLowerCase();
  const hasExternalEmails = external_emails && external_emails.length > 0;

  // Rule 1: No external emails -> likely internal
  if (!hasExternalEmails) {
    return {
      should_send: false,
      call_type: "internal",
      confidence: 0.7,
      reason: "No external participants detected - appears to be an internal call",
    };
  }

  // Rule 2: Check title for internal keywords
  for (const keyword of INTERNAL_KEYWORDS) {
    if (titleLower.includes(keyword)) {
      return {
        should_send: false,
        call_type: "internal",
        confidence: 0.8,
        reason: `Call title contains "${keyword}" - appears to be an internal meeting`,
      };
    }
  }

  // Rule 3: Check transcript for new business keywords
  if (transcript) {
    const matchedKeywords: string[] = [];
    for (const keyword of NEW_BUSINESS_KEYWORDS) {
      if (transcriptLower.includes(keyword)) {
        matchedKeywords.push(keyword);
      }
    }

    if (matchedKeywords.length >= 2) {
      return {
        should_send: true,
        call_type: "new_business",
        confidence: 0.85,
        reason: `Transcript contains sales-related keywords: ${matchedKeywords.slice(0, 3).join(", ")}`,
      };
    }

    if (matchedKeywords.length === 1) {
      return {
        should_send: true,
        call_type: "new_business",
        confidence: 0.6,
        reason: `Transcript contains sales-related keyword: ${matchedKeywords[0]}`,
      };
    }
  }

  // Rule 4: Has external emails but no transcript - allow with lower confidence
  if (hasExternalEmails && !transcript) {
    return {
      should_send: false,
      call_type: "unknown",
      confidence: 0.4,
      reason: "External call but no transcript provided - cannot determine call type",
    };
  }

  // Default: Not clearly a sales call
  return {
    should_send: false,
    call_type: "unknown",
    confidence: 0.5,
    reason: "Not clearly a new business prospect call - no sales-related keywords found in transcript",
  };
}

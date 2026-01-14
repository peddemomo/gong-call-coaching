/**
 * Gong API Client
 * 
 * Provides methods to fetch call metadata and transcripts from the Gong API.
 * Uses Basic Auth with GONG_ACCESS_KEY:GONG_ACCESS_SECRET.
 */

export interface GongParticipant {
  emailAddress?: string;
  name: string;
  affiliation: "internal" | "external" | "unknown";
}

export interface GongCallMetadata {
  id: string;
  title: string;
  started: string;
  duration: number;
  url: string;
  parties: GongParticipant[];
}

export interface GongTranscriptSegment {
  speakerName: string;
  topic?: string;
  sentences: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

export interface GongTranscript {
  callId: string;
  transcript: GongTranscriptSegment[];
}

// Environment variables
const GONG_ACCESS_KEY = process.env.GONG_ACCESS_KEY;
const GONG_ACCESS_SECRET = process.env.GONG_ACCESS_SECRET;
const GONG_BASE_URL = process.env.GONG_BASE_URL || "https://api.gong.io";

function getAuthHeader(): string {
  if (!GONG_ACCESS_KEY || !GONG_ACCESS_SECRET) {
    throw new Error(
      "Missing Gong credentials. Set GONG_ACCESS_KEY and GONG_ACCESS_SECRET environment variables."
    );
  }
  const credentials = Buffer.from(`${GONG_ACCESS_KEY}:${GONG_ACCESS_SECRET}`).toString("base64");
  return `Basic ${credentials}`;
}

/**
 * Fetch call metadata by Gong call ID
 * Uses the /v2/calls/extensive endpoint with a call ID filter
 */
export async function getCallById(gongCallId: string): Promise<GongCallMetadata> {
  const authHeader = getAuthHeader();

  const response = await fetch(`${GONG_BASE_URL}/v2/calls/extensive`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filter: {
        callIds: [gongCallId],
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gong API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (!data.calls || data.calls.length === 0) {
    throw new Error(`Call not found: ${gongCallId}`);
  }

  const call = data.calls[0];
  const metaData = call.metaData || call;

  return {
    id: metaData.id || gongCallId,
    title: metaData.title || "Untitled Call",
    started: metaData.started || new Date().toISOString(),
    duration: metaData.duration || 0,
    url: metaData.url || "",
    parties: (call.parties || []).map((p: { emailAddress?: string; name?: string; affiliation?: string }) => ({
      emailAddress: p.emailAddress,
      name: p.name || "Unknown",
      affiliation: p.affiliation as GongParticipant["affiliation"] || "unknown",
    })),
  };
}

/**
 * Fetch transcript by Gong call ID
 * Uses the /v2/calls/transcript endpoint
 */
export async function getTranscriptByCallId(gongCallId: string): Promise<string> {
  const authHeader = getAuthHeader();

  const response = await fetch(`${GONG_BASE_URL}/v2/calls/transcript`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filter: {
        callIds: [gongCallId],
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gong API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (!data.callTranscripts || data.callTranscripts.length === 0) {
    return ""; // No transcript available
  }

  const transcriptData: GongTranscript = data.callTranscripts[0];
  
  // Format transcript as plain text
  const lines: string[] = [];
  for (const segment of transcriptData.transcript || []) {
    for (const sentence of segment.sentences || []) {
      lines.push(`${segment.speakerName}: ${sentence.text}`);
    }
  }

  return lines.join("\n");
}

/**
 * Helper to determine primary AE (call owner / primary internal participant)
 * Returns the first internal participant with an email, or null if not found.
 */
export function getPrimaryAEEmail(parties: GongParticipant[]): string | null {
  const internalParticipants = parties.filter(
    (p) => p.affiliation === "internal" && p.emailAddress
  );

  if (internalParticipants.length === 0) {
    return null;
  }

  // Return the first internal participant's email (typically the call owner)
  return internalParticipants[0].emailAddress || null;
}

/**
 * Helper to get external participant emails
 */
export function getExternalEmails(parties: GongParticipant[]): string[] {
  return parties
    .filter((p) => p.affiliation === "external" && p.emailAddress)
    .map((p) => p.emailAddress as string);
}

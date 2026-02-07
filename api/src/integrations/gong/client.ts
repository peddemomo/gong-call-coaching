/**
 * Gong API Client
 * 
 * Provides methods to fetch call metadata and transcripts from the Gong API.
 * Uses Basic Auth with GONG_ACCESS_KEY:GONG_ACCESS_SECRET.
 */

export interface GongParticipant {
  emailAddress?: string;
  name: string;
  affiliation: string; // Gong returns "Internal", "External", "Unknown" (capitalized)
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
  const url = `${GONG_BASE_URL}/v2/calls/extensive`;
  const requestBody = {
    filter: {
      callIds: [gongCallId],
    },
    // Request parties data to get participant information
    contentSelector: {
      exposedFields: {
        parties: true,
      },
    },
  };

  console.log(`[Gong] Fetching call metadata for: ${gongCallId}`);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (fetchError) {
    console.error(`[Gong] Fetch error:`, fetchError);
    throw new Error(`Gong API fetch failed: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Gong] API error (${response.status}):`, errorText);
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
  const url = `${GONG_BASE_URL}/v2/calls/transcript`;
  const requestBody = {
    filter: {
      callIds: [gongCallId],
    },
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (fetchError) {
    console.error(`[Gong] Transcript fetch error:`, fetchError);
    throw new Error(`Gong transcript API fetch failed: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Gong] Transcript API error (${response.status}):`, errorText);
    throw new Error(`Gong transcript API error (${response.status}): ${errorText}`);
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
 * @deprecated Use getInternalEmails() for AE-first selection logic
 */
export function getPrimaryAEEmail(parties: GongParticipant[]): string | null {
  // Gong API returns affiliation with capital letters (e.g., "Internal", "External")
  const internalParticipants = parties.filter(
    (p) => p.affiliation.toLowerCase() === "internal" && p.emailAddress
  );

  if (internalParticipants.length === 0) {
    return null;
  }

  // Return the first internal participant's email (typically the call owner)
  return internalParticipants[0].emailAddress || null;
}

/**
 * Helper to get all internal participant emails
 * Used for AE-first selection: check which internal participants are configured AEs
 */
export function getInternalEmails(parties: GongParticipant[]): string[] {
  return parties
    .filter((p) => p.affiliation.toLowerCase() === "internal" && p.emailAddress)
    .map((p) => p.emailAddress as string);
}

/**
 * Helper to get external participant emails
 */
export function getExternalEmails(parties: GongParticipant[]): string[] {
  // Gong API returns affiliation with capital letters (e.g., "Internal", "External")
  return parties
    .filter((p) => p.affiliation.toLowerCase() === "external" && p.emailAddress)
    .map((p) => p.emailAddress as string);
}

/**
 * Helper to get external participant names (for value-point / insight attribution in coaching email)
 */
export function getExternalSpeakerNames(parties: GongParticipant[]): string[] {
  return parties
    .filter((p) => p.affiliation.toLowerCase() === "external" && p.name)
    .map((p) => p.name);
}

/**
 * Fetch recent completed calls from Gong
 * Uses the /v2/calls endpoint with date filters
 * 
 * @param fromDate - Start of time range (ISO string)
 * @param toDate - End of time range (ISO string), defaults to now
 * @returns Array of call metadata with participant info
 */
export async function getRecentCalls(
  fromDate: string,
  toDate?: string
): Promise<GongCallMetadata[]> {
  const authHeader = getAuthHeader();
  const url = `${GONG_BASE_URL}/v2/calls/extensive`;
  
  const requestBody = {
    filter: {
      fromDateTime: fromDate,
      toDateTime: toDate || new Date().toISOString(),
    },
    contentSelector: {
      exposedFields: {
        parties: true,
      },
    },
  };

  console.log(`[Gong] Fetching calls from ${fromDate} to ${toDate || "now"}`);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (fetchError) {
    console.error(`[Gong] Fetch error:`, fetchError);
    throw new Error(`Gong API fetch failed: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
  }

  if (!response.ok) {
    // Gong returns 404 when no calls match the filter - this is not an error
    if (response.status === 404) {
      console.log(`[Gong] No calls found in the specified time range`);
      return [];
    }
    const errorText = await response.text();
    console.error(`[Gong] API error (${response.status}):`, errorText);
    throw new Error(`Gong API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (!data.calls || data.calls.length === 0) {
    console.log(`[Gong] No calls found in the specified time range`);
    return [];
  }

  console.log(`[Gong] Found ${data.calls.length} calls`);

  return data.calls.map((call: { metaData?: Record<string, unknown>; parties?: Array<{ emailAddress?: string; name?: string; affiliation?: string }> }) => {
    const metaData = call.metaData || call;
    return {
      id: (metaData as Record<string, unknown>).id as string || "",
      title: (metaData as Record<string, unknown>).title as string || "Untitled Call",
      started: (metaData as Record<string, unknown>).started as string || new Date().toISOString(),
      duration: (metaData as Record<string, unknown>).duration as number || 0,
      url: (metaData as Record<string, unknown>).url as string || "",
      parties: (call.parties || []).map((p) => ({
        emailAddress: p.emailAddress,
        name: p.name || "Unknown",
        affiliation: p.affiliation as GongParticipant["affiliation"] || "unknown",
      })),
    };
  });
}

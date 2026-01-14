import axios, { AxiosInstance } from "axios";

export interface GongCall {
  id: string;
  title: string;
  started: string;
  duration: number;
  url: string;
  parties: Array<{
    emailAddress?: string;
    name: string;
    affiliation: string;
  }>;
}

interface GongCallRaw {
  id?: string;
  metaData?: {
    id: string;
    title: string;
    started: string;
    duration: number;
    url: string;
  };
  parties?: Array<{
    emailAddress?: string;
    name: string;
    affiliation: string;
  }>;
  title?: string;
  started?: string;
  duration?: number;
  url?: string;
}

export interface GongTranscript {
  callId: string;
  transcript: Array<{
    speakerName: string;
    topic?: string;
    sentences: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  }>;
}

export class GongClient {
  private client: AxiosInstance;

  constructor(accessKey: string, accessSecret: string, baseUrl: string) {
    // Gong uses Basic Auth with accessKey:accessSecret
    const authToken = Buffer.from(`${accessKey}:${accessSecret}`).toString(
      "base64"
    );

    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Basic ${authToken}`,
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Get the date range for the past business week (Monday-Friday)
   */
  getLastWeekDateRange(): { fromDateTime: string; toDateTime: string } {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // Find last Friday (end of last business week)
    let daysToLastFriday: number;
    if (dayOfWeek === 0) {
      // Sunday
      daysToLastFriday = 2;
    } else if (dayOfWeek === 6) {
      // Saturday
      daysToLastFriday = 1;
    } else {
      // Mon-Fri: go back to previous Friday
      daysToLastFriday = dayOfWeek + 2;
    }

    const lastFriday = new Date(now);
    lastFriday.setDate(now.getDate() - daysToLastFriday);
    lastFriday.setHours(23, 59, 59, 999);

    // Find last Monday (start of last business week)
    const lastMonday = new Date(lastFriday);
    lastMonday.setDate(lastFriday.getDate() - 4);
    lastMonday.setHours(0, 0, 0, 0);

    return {
      fromDateTime: lastMonday.toISOString(),
      toDateTime: lastFriday.toISOString(),
    };
  }

  /**
   * Fetch all calls within the date range
   */
  async getCalls(
    fromDateTime: string,
    toDateTime: string
  ): Promise<GongCall[]> {
    const allCalls: GongCall[] = [];
    let cursor: string | undefined;

    console.log(`Fetching calls from ${fromDateTime} to ${toDateTime}...`);

    do {
      try {
        const requestBody: Record<string, unknown> = {
          filter: {
            fromDateTime,
            toDateTime,
          },
        };
        
        if (cursor) {
          requestBody.cursor = cursor;
        }

        const response = await this.client.post("/v2/calls/extensive", requestBody);

        const { calls, records } = response.data;
        if (calls && calls.length > 0) {
          // Normalize the call structure - extensive API returns metaData nested
          const normalizedCalls: GongCall[] = calls.map((call: GongCallRaw) => ({
            id: call.metaData?.id || call.id || "",
            title: call.metaData?.title || call.title || "Untitled Call",
            started: call.metaData?.started || call.started || new Date().toISOString(),
            duration: call.metaData?.duration || call.duration || 0,
            url: call.metaData?.url || call.url || "",
            parties: call.parties || [],
          }));
          allCalls.push(...normalizedCalls);
        }

        cursor = records?.cursor;
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as { response?: { data?: unknown } };
          console.error("Gong API Error:", JSON.stringify(axiosError.response?.data, null, 2));
        }
        throw error;
      }
    } while (cursor);

    console.log(`Found ${allCalls.length} calls in date range`);
    return allCalls;
  }

  /**
   * Fetch transcripts for given call IDs (batched)
   */
  async getTranscripts(callIds: string[]): Promise<GongTranscript[]> {
    if (callIds.length === 0) return [];

    const allTranscripts: GongTranscript[] = [];
    const batchSize = 50; // Gong API limit

    console.log(`Fetching transcripts for ${callIds.length} calls...`);

    for (let i = 0; i < callIds.length; i += batchSize) {
      const batch = callIds.slice(i, i + batchSize);
      let cursor: string | undefined;

      do {
        try {
          const requestBody: Record<string, unknown> = {
            filter: {
              callIds: batch,
            },
          };
          
          if (cursor) {
            requestBody.cursor = cursor;
          }

          const response = await this.client.post("/v2/calls/transcript", requestBody);

          const { callTranscripts, records } = response.data;
          if (callTranscripts && callTranscripts.length > 0) {
            allTranscripts.push(...callTranscripts);
          }

          cursor = records?.cursor;
        } catch (error: unknown) {
          if (error && typeof error === 'object' && 'response' in error) {
            const axiosError = error as { response?: { data?: unknown } };
            console.error("Gong Transcript API Error:", JSON.stringify(axiosError.response?.data, null, 2));
          }
          throw error;
        }
      } while (cursor);
    }

    console.log(`Retrieved ${allTranscripts.length} transcripts`);
    return allTranscripts;
  }

  /**
   * Combine call metadata with transcript into a readable format
   */
  formatCallWithTranscript(
    call: GongCall,
    transcript: GongTranscript | undefined
  ): string {
    const parties = call.parties
      .map((p) => `${p.name} (${p.affiliation})`)
      .join(", ");

    let formatted = `
=== CALL: ${call.title} ===
Date: ${new Date(call.started).toLocaleDateString()}
Duration: ${Math.round(call.duration / 60)} minutes
Participants: ${parties}
URL: ${call.url}

--- TRANSCRIPT ---
`;

    if (!transcript || !transcript.transcript) {
      formatted += "[No transcript available]\n";
    } else {
      for (const segment of transcript.transcript) {
        for (const sentence of segment.sentences) {
          formatted += `${segment.speakerName}: ${sentence.text}\n`;
        }
      }
    }

    return formatted;
  }
}


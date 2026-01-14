import axios, { AxiosInstance } from "axios";

export interface McpSearchResult {
  id: string;
  content: string;
  metadata?: {
    callId?: string;
    callTitle?: string;
    callDate?: string;
    callUrl?: string;
    speakerName?: string;
    [key: string]: unknown;
  };
}

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

export class GongMcpClient {
  private client: AxiosInstance;
  private mcpBaseUrl: string;
  private authToken: string;

  constructor(mcpBaseUrl: string, authToken: string) {
    this.mcpBaseUrl = mcpBaseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.authToken = authToken;

    this.client = axios.create({
      baseURL: this.mcpBaseUrl,
      headers: {
        Authorization: `Bearer ${authToken}`,
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
   * Search for calls using the MCP service
   * Uses JSON-RPC 2.0 protocol
   */
  async search(query: string, limit = 100): Promise<McpSearchResult[]> {
    try {
      const response = await this.client.post("/mcp/gong-calls", {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "search",
          arguments: {
            query,
          },
        },
        id: 1,
      });

      if (response.data.error) {
        throw new Error(`MCP search error: ${JSON.stringify(response.data.error)}`);
      }

      const results = response.data.result?.results || [];
      return results.slice(0, limit);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as { response?: { data?: unknown } };
        console.error("MCP Search Error:", JSON.stringify(axiosError.response?.data, null, 2));
      }
      throw error;
    }
  }

  /**
   * Fetch a full document by ID using the MCP service
   */
  async fetch(documentId: string): Promise<McpSearchResult | null> {
    try {
      const response = await this.client.post("/mcp/gong-calls", {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "fetch",
          arguments: {
            id: documentId,
          },
        },
        id: 1,
      });

      if (response.data.error) {
        throw new Error(`MCP fetch error: ${JSON.stringify(response.data.error)}`);
      }

      return response.data.result || null;
    } catch (error: unknown) {
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as { response?: { data?: unknown } };
        console.error("MCP Fetch Error:", JSON.stringify(axiosError.response?.data, null, 2));
      }
      return null;
    }
  }

  /**
   * Search for calls from the past week using date-based queries
   */
  async getCallsFromLastWeek(
    fromDateTime: string,
    toDateTime: string
  ): Promise<McpSearchResult[]> {
    // Format dates for search query
    const fromDate = new Date(fromDateTime).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const toDate = new Date(toDateTime).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    // Search for calls in the date range
    // The MCP service uses semantic search, so we'll search broadly
    const query = `calls from ${fromDate} to ${toDate}`;
    console.log(`Searching for calls: ${query}`);

    const results = await this.search(query, 200);

    // Filter results to only include calls within our date range
    const filtered = results.filter((result) => {
      const callDate = result.metadata?.callDate;
      if (!callDate) return false;

      const date = new Date(callDate);
      const from = new Date(fromDateTime);
      const to = new Date(toDateTime);

      return date >= from && date <= to;
    });

    return filtered;
  }

  /**
   * Search for competitor mentions directly using semantic search
   * This is more efficient than fetching all calls and analyzing them
   */
  async searchCompetitorMentions(
    competitors: string[],
    fromDateTime: string,
    toDateTime: string
  ): Promise<McpSearchResult[]> {
    const fromDate = new Date(fromDateTime).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const toDate = new Date(toDateTime).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const allResults: McpSearchResult[] = [];

    // Search for each competitor
    for (const competitor of competitors) {
      const query = `${competitor} mentioned in calls from ${fromDate} to ${toDate}`;
      console.log(`Searching for mentions of: ${competitor}`);

      try {
        const results = await this.search(query, 50);
        allResults.push(...results);

        // Small delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error searching for ${competitor}:`, error);
      }
    }

    // Also search for general competitor mentions
    const generalQuery = `competitors alternatives vendors other solutions mentioned in calls from ${fromDate} to ${toDate}`;
    console.log(`Searching for general competitor mentions...`);

    try {
      const generalResults = await this.search(generalQuery, 50);
      allResults.push(...generalResults);
    } catch (error) {
      console.error(`Error searching for general mentions:`, error);
    }

    // Deduplicate by ID
    const uniqueResults = new Map<string, McpSearchResult>();
    for (const result of allResults) {
      if (result.id && !uniqueResults.has(result.id)) {
        uniqueResults.set(result.id, result);
      }
    }

    return Array.from(uniqueResults.values());
  }

  /**
   * Convert MCP search results to the format expected by the analyzer
   */
  formatMcpResultsForAnalysis(
    results: McpSearchResult[]
  ): Array<{
    title: string;
    date: string;
    url: string;
    transcript: string;
  }> {
    // Group results by call
    const callsMap = new Map<
      string,
      {
        title: string;
        date: string;
        url: string;
        snippets: string[];
      }
    >();

    for (const result of results) {
      const callId = result.metadata?.callId || result.id;
      const title = (result.metadata?.callTitle as string) || "Unknown Call";
      const date = (result.metadata?.callDate as string) || new Date().toISOString();
      const url = (result.metadata?.callUrl as string) || "";
      const speaker = (result.metadata?.speakerName as string) || "Speaker";

      if (!callsMap.has(callId)) {
        callsMap.set(callId, {
          title,
          date,
          url,
          snippets: [],
        });
      }

      const call = callsMap.get(callId)!;
      // Include speaker context if available
      const snippet = speaker
        ? `${speaker}: ${result.content}`
        : result.content;
      call.snippets.push(snippet);
    }

    // Convert to array format
    return Array.from(callsMap.values()).map((call) => ({
      title: call.title,
      date: new Date(call.date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      url: call.url,
      transcript: call.snippets.join("\n\n"),
    }));
  }
}


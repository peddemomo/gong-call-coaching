import OpenAI from "openai";

export interface CompetitorMention {
  competitor: string;
  callTitle: string;
  callDate: string;
  callUrl: string;
  context: string;
  sentiment: "positive" | "negative" | "neutral";
  keyPoints: string[];
}

export interface CompetitiveDigest {
  dateRange: { start: string; end: string };
  totalCallsAnalyzed: number;
  callsWithCompetitorMentions: number;
  mentions: CompetitorMention[];
  summary: string;
  trends: string[];
  actionItems: string[];
}

const KNOWN_COMPETITORS = [
  "Definitive Healthcare",
  "MedScout",
  "RepSignal",
  "Axiom",
  "IQVIA",
  "Carevoyance",
];

const ANALYSIS_PROMPT = `You are a competitive intelligence analyst reviewing sales call transcripts. Your job is to identify and analyze mentions of competitors.

KNOWN COMPETITORS TO WATCH:
${KNOWN_COMPETITORS.map((c) => `- ${c}`).join("\n")}

ALSO look for:
- Any other companies mentioned as alternatives or competitors
- References to "other vendors", "other solutions", "alternatives we're looking at"
- Comparisons to unnamed competitors ("the other tool", "what we're using now", etc.)

For each call transcript provided, extract:
1. Which competitors were mentioned (known or newly discovered)
2. The context of each mention (what was said about them)
3. The sentiment (positive, negative, or neutral toward the competitor)
4. Key competitive insights or objections raised

Be thorough but concise. Focus on actionable competitive intelligence.`;

export class CompetitorAnalyzer {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Analyze a batch of call transcripts for competitor mentions
   */
  async analyzeTranscripts(
    calls: Array<{
      title: string;
      date: string;
      url: string;
      transcript: string;
    }>
  ): Promise<CompetitorMention[]> {
    const allMentions: CompetitorMention[] = [];

    console.log(`Analyzing ${calls.length} calls for competitor mentions...`);

    // Process calls sequentially to avoid rate limits (30k TPM on free tier)
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i];
      console.log(`  [${i + 1}/${calls.length}] Analyzing: ${call.title}`);
      
      try {
        const mentions = await this.analyzeCallWithRetry(call);
        allMentions.push(...mentions);
      } catch (error) {
        console.error(`  ⚠️ Failed to analyze "${call.title}":`, error instanceof Error ? error.message : error);
      }

      // Delay between calls to stay under rate limits
      // 30k TPM / ~4k tokens per call = ~7 calls per minute max
      // So we wait ~10 seconds between calls to be safe
      if (i < calls.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }

    console.log(`Found ${allMentions.length} competitor mentions`);
    return allMentions;
  }

  /**
   * Analyze a call with retry logic for rate limits
   */
  private async analyzeCallWithRetry(
    call: { title: string; date: string; url: string; transcript: string },
    maxRetries = 3
  ): Promise<CompetitorMention[]> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.analyzeCall(call);
      } catch (error: unknown) {
        const isRateLimit = error instanceof Error && 
          ('status' in error && (error as {status: number}).status === 429);
        
        if (isRateLimit && attempt < maxRetries) {
          // Extract retry-after from error if available, otherwise use exponential backoff
          let waitTime = Math.pow(2, attempt) * 10000; // 20s, 40s, 80s
          
          if (error && typeof error === 'object' && 'headers' in error) {
            const headers = (error as { headers?: { 'retry-after-ms'?: string } }).headers;
            if (headers?.['retry-after-ms']) {
              waitTime = parseInt(headers['retry-after-ms'], 10) + 1000; // Add 1s buffer
            }
          }
          
          console.log(`  ⏳ Rate limited, waiting ${Math.round(waitTime / 1000)}s before retry ${attempt + 1}/${maxRetries}...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }
        throw error;
      }
    }
    return [];
  }

  /**
   * Analyze a single call transcript
   */
  private async analyzeCall(call: {
    title: string;
    date: string;
    url: string;
    transcript: string;
  }): Promise<CompetitorMention[]> {
    // Skip very short transcripts
    if (call.transcript.length < 100) {
      return [];
    }

    // Truncate very long transcripts to manage token usage
    const maxTranscriptLength = 15000;
    const truncatedTranscript =
      call.transcript.length > maxTranscriptLength
        ? call.transcript.slice(0, maxTranscriptLength) + "\n[... transcript truncated ...]"
        : call.transcript;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: ANALYSIS_PROMPT },
        {
          role: "user",
          content: `Analyze this call transcript for competitor mentions. Return a JSON array of mentions.

CALL TITLE: ${call.title}
CALL DATE: ${call.date}

TRANSCRIPT:
${truncatedTranscript}

Return JSON in this exact format (empty array if no competitors mentioned):
[
  {
    "competitor": "Company Name",
    "context": "Brief quote or description of what was said",
    "sentiment": "positive" | "negative" | "neutral",
    "keyPoints": ["point 1", "point 2"]
  }
]

Only return the JSON array, no other text.`,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    try {
      const parsed = JSON.parse(content);
      const mentions = Array.isArray(parsed) ? parsed : parsed.mentions || [];

      return mentions.map(
        (m: {
          competitor: string;
          context: string;
          sentiment: string;
          keyPoints: string[];
        }) => ({
          competitor: m.competitor,
          callTitle: call.title,
          callDate: call.date,
          callUrl: call.url,
          context: m.context,
          sentiment: m.sentiment as "positive" | "negative" | "neutral",
          keyPoints: m.keyPoints || [],
        })
      );
    } catch {
      console.error("Failed to parse OpenAI response for call:", call.title);
      return [];
    }
  }

  /**
   * Generate the final digest summary
   */
  async generateDigestSummary(
    mentions: CompetitorMention[],
    dateRange: { start: string; end: string },
    totalCalls: number
  ): Promise<CompetitiveDigest> {
    const callsWithMentions = new Set(mentions.map((m) => m.callTitle)).size;

    // Group mentions by competitor
    const byCompetitor = mentions.reduce(
      (acc, m) => {
        if (!acc[m.competitor]) acc[m.competitor] = [];
        acc[m.competitor].push(m);
        return acc;
      },
      {} as Record<string, CompetitorMention[]>
    );

    const mentionsSummary = Object.entries(byCompetitor)
      .map(
        ([competitor, items]) =>
          `${competitor}: ${items.length} mention(s) - Sentiments: ${items.map((i) => i.sentiment).join(", ")}`
      )
      .join("\n");

    const contextsForAI = mentions
      .slice(0, 30) // Limit to avoid token issues
      .map((m) => `- ${m.competitor}: "${m.context}"`)
      .join("\n");

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a competitive intelligence analyst creating an executive summary. Be concise, actionable, and strategic.`,
        },
        {
          role: "user",
          content: `Create an executive summary of competitive activity from this week's sales calls.

DATE RANGE: ${dateRange.start} to ${dateRange.end}
TOTAL CALLS ANALYZED: ${totalCalls}
CALLS WITH COMPETITOR MENTIONS: ${callsWithMentions}

COMPETITOR MENTION SUMMARY:
${mentionsSummary || "No competitor mentions found"}

SAMPLE CONTEXTS:
${contextsForAI || "None"}

Generate a JSON response with:
{
  "summary": "2-3 paragraph executive summary of competitive landscape this week",
  "trends": ["trend 1", "trend 2", ...] (3-5 notable trends),
  "actionItems": ["action 1", "action 2", ...] (2-4 recommended actions)
}`,
        },
      ],
      temperature: 0.5,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    let summary = "No significant competitive activity detected this week.";
    let trends: string[] = [];
    let actionItems: string[] = [];

    if (content) {
      try {
        const parsed = JSON.parse(content);
        summary = parsed.summary || summary;
        trends = parsed.trends || [];
        actionItems = parsed.actionItems || [];
      } catch {
        console.error("Failed to parse digest summary response");
      }
    }

    return {
      dateRange,
      totalCallsAnalyzed: totalCalls,
      callsWithCompetitorMentions: callsWithMentions,
      mentions,
      summary,
      trends,
      actionItems,
    };
  }
}


import nodemailer from "nodemailer";
import { CompetitiveDigest, CompetitorMention } from "./competitorAnalyzer";

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(config: EmailConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  /**
   * Send the competitive digest email
   */
  async sendDigest(
    to: string,
    digest: CompetitiveDigest,
    from: string
  ): Promise<void> {
    const subject = `🔍 Competitive Intelligence Digest: ${this.formatDateRange(digest.dateRange)}`;

    const html = this.generateHtmlEmail(digest);
    const text = this.generateTextEmail(digest);

    await this.transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });

    console.log(`Digest email sent to ${to}`);
  }

  private formatDateRange(range: { start: string; end: string }): string {
    const start = new Date(range.start).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const end = new Date(range.end).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${start} - ${end}`;
  }

  private groupMentionsByCompetitor(
    mentions: CompetitorMention[]
  ): Record<string, CompetitorMention[]> {
    return mentions.reduce(
      (acc, m) => {
        if (!acc[m.competitor]) acc[m.competitor] = [];
        acc[m.competitor].push(m);
        return acc;
      },
      {} as Record<string, CompetitorMention[]>
    );
  }

  private getSentimentEmoji(sentiment: string): string {
    switch (sentiment) {
      case "positive":
        return "🟢";
      case "negative":
        return "🔴";
      default:
        return "🟡";
    }
  }

  private generateHtmlEmail(digest: CompetitiveDigest): string {
    const byCompetitor = this.groupMentionsByCompetitor(digest.mentions);

    const competitorSections = Object.entries(byCompetitor)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([competitor, mentions]) => {
        const mentionsList = mentions
          .map(
            (m) => `
          <li style="margin-bottom: 12px; padding: 12px; background: #f8f9fa; border-radius: 6px;">
            <div style="font-weight: 600; color: #1a1a2e;">
              ${this.getSentimentEmoji(m.sentiment)} 
              <a href="${m.callUrl}" style="color: #4361ee; text-decoration: none;">${m.callTitle}</a>
            </div>
            <div style="color: #666; font-size: 13px; margin: 4px 0;">${m.callDate}</div>
            <div style="color: #333; margin-top: 8px; font-style: italic;">"${m.context}"</div>
            ${
              m.keyPoints.length > 0
                ? `
              <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #444;">
                ${m.keyPoints.map((p) => `<li style="margin: 4px 0;">${p}</li>`).join("")}
              </ul>
            `
                : ""
            }
          </li>
        `
          )
          .join("");

        return `
        <div style="margin-bottom: 24px;">
          <h3 style="color: #1a1a2e; border-bottom: 2px solid #4361ee; padding-bottom: 8px; margin-bottom: 12px;">
            ${competitor} <span style="font-weight: normal; color: #666;">(${mentions.length} mention${mentions.length > 1 ? "s" : ""})</span>
          </h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${mentionsList}
          </ul>
        </div>
      `;
      })
      .join("");

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0;">
    <h1 style="margin: 0 0 8px 0; font-size: 28px;">🔍 Competitive Intelligence Digest</h1>
    <p style="margin: 0; opacity: 0.9; font-size: 16px;">${this.formatDateRange(digest.dateRange)}</p>
  </div>

  <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    
    <!-- Stats -->
    <div style="display: flex; gap: 20px; margin-bottom: 30px; flex-wrap: wrap;">
      <div style="flex: 1; min-width: 150px; background: #e8f4f8; padding: 20px; border-radius: 8px; text-align: center;">
        <div style="font-size: 32px; font-weight: bold; color: #4361ee;">${digest.totalCallsAnalyzed}</div>
        <div style="color: #666; font-size: 14px;">Calls Analyzed</div>
      </div>
      <div style="flex: 1; min-width: 150px; background: #fff3e0; padding: 20px; border-radius: 8px; text-align: center;">
        <div style="font-size: 32px; font-weight: bold; color: #f77f00;">${digest.callsWithCompetitorMentions}</div>
        <div style="color: #666; font-size: 14px;">With Competitor Mentions</div>
      </div>
      <div style="flex: 1; min-width: 150px; background: #e8f5e9; padding: 20px; border-radius: 8px; text-align: center;">
        <div style="font-size: 32px; font-weight: bold; color: #2e7d32;">${digest.mentions.length}</div>
        <div style="color: #666; font-size: 14px;">Total Mentions</div>
      </div>
    </div>

    <!-- Executive Summary -->
    <div style="margin-bottom: 30px;">
      <h2 style="color: #1a1a2e; margin-bottom: 12px;">📊 Executive Summary</h2>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #4361ee;">
        ${digest.summary.split("\n").map((p) => `<p style="margin: 0 0 12px 0;">${p}</p>`).join("")}
      </div>
    </div>

    ${
      digest.trends.length > 0
        ? `
    <!-- Trends -->
    <div style="margin-bottom: 30px;">
      <h2 style="color: #1a1a2e; margin-bottom: 12px;">📈 Key Trends</h2>
      <ul style="background: #f8f9fa; padding: 20px 20px 20px 40px; border-radius: 8px; margin: 0;">
        ${digest.trends.map((t) => `<li style="margin: 8px 0; color: #333;">${t}</li>`).join("")}
      </ul>
    </div>
    `
        : ""
    }

    ${
      digest.actionItems.length > 0
        ? `
    <!-- Action Items -->
    <div style="margin-bottom: 30px;">
      <h2 style="color: #1a1a2e; margin-bottom: 12px;">✅ Recommended Actions</h2>
      <ul style="background: #e8f5e9; padding: 20px 20px 20px 40px; border-radius: 8px; margin: 0;">
        ${digest.actionItems.map((a) => `<li style="margin: 8px 0; color: #1b5e20;">${a}</li>`).join("")}
      </ul>
    </div>
    `
        : ""
    }

    ${
      digest.mentions.length > 0
        ? `
    <!-- Detailed Mentions -->
    <div style="margin-bottom: 20px;">
      <h2 style="color: #1a1a2e; margin-bottom: 16px;">📝 Detailed Mentions by Competitor</h2>
      ${competitorSections}
    </div>
    `
        : `
    <div style="text-align: center; padding: 40px; color: #666;">
      <p style="font-size: 18px;">No competitor mentions detected this week.</p>
      <p>This could mean your team is focusing on value propositions without direct competitive comparisons, or prospects aren't actively evaluating alternatives.</p>
    </div>
    `
    }

    <!-- Footer -->
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 13px; text-align: center;">
      <p style="margin: 0;">Generated automatically from Gong call transcripts</p>
      <p style="margin: 4px 0 0 0;">Legend: 🟢 Positive | 🟡 Neutral | 🔴 Negative sentiment toward competitor</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private generateTextEmail(digest: CompetitiveDigest): string {
    const byCompetitor = this.groupMentionsByCompetitor(digest.mentions);

    let text = `COMPETITIVE INTELLIGENCE DIGEST
${this.formatDateRange(digest.dateRange)}
${"=".repeat(50)}

STATS
-----
• Calls Analyzed: ${digest.totalCallsAnalyzed}
• Calls with Competitor Mentions: ${digest.callsWithCompetitorMentions}
• Total Mentions: ${digest.mentions.length}

EXECUTIVE SUMMARY
-----------------
${digest.summary}

`;

    if (digest.trends.length > 0) {
      text += `KEY TRENDS
----------
${digest.trends.map((t) => `• ${t}`).join("\n")}

`;
    }

    if (digest.actionItems.length > 0) {
      text += `RECOMMENDED ACTIONS
-------------------
${digest.actionItems.map((a) => `• ${a}`).join("\n")}

`;
    }

    if (digest.mentions.length > 0) {
      text += `DETAILED MENTIONS BY COMPETITOR
-------------------------------
`;

      for (const [competitor, mentions] of Object.entries(byCompetitor)) {
        text += `\n${competitor} (${mentions.length} mention${mentions.length > 1 ? "s" : ""})\n`;
        text += "-".repeat(competitor.length + 15) + "\n";

        for (const m of mentions) {
          text += `\n  [${m.sentiment.toUpperCase()}] ${m.callTitle}\n`;
          text += `  Date: ${m.callDate}\n`;
          text += `  URL: ${m.callUrl}\n`;
          text += `  Context: "${m.context}"\n`;
          if (m.keyPoints.length > 0) {
            text += `  Key Points:\n`;
            for (const p of m.keyPoints) {
              text += `    - ${p}\n`;
            }
          }
        }
      }
    }

    text += `
${"=".repeat(50)}
Generated automatically from Gong call transcripts
Legend: POSITIVE | NEUTRAL | NEGATIVE sentiment toward competitor
`;

    return text;
  }
}


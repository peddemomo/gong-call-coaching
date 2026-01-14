import "dotenv/config";
import { GongClient } from "./services/gongClient";
import { CompetitorAnalyzer } from "./services/competitorAnalyzer";
import { EmailService } from "./services/emailService";

interface Config {
  gong: {
    accessKey: string;
    accessSecret: string;
    baseUrl: string;
  };
  openai: {
    apiKey: string;
  };
  email: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
    to: string;
  };
}

function loadConfig(): Config {
  const required = [
    "GONG_ACCESS_KEY",
    "GONG_ACCESS_SECRET",
    "OPENAI_API_KEY",
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASS",
    "EMAIL_TO",
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error("\n❌ Missing required environment variables:");
    missing.forEach((key) => {
      console.error(`   - ${key}`);
    });
    console.error("\n💡 Make sure your .env file has all required variables.\n");
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    gong: {
      accessKey: process.env.GONG_ACCESS_KEY!,
      accessSecret: process.env.GONG_ACCESS_SECRET!,
      baseUrl: process.env.GONG_BASE_URL || "https://api.gong.io",
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY!,
    },
    email: {
      host: process.env.SMTP_HOST!,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
      from: process.env.EMAIL_FROM || process.env.SMTP_USER!,
      to: process.env.EMAIL_TO!,
    },
  };
}

async function main() {
  console.log("🚀 Starting Competitive Intelligence Digest Generation...\n");

  // Load configuration
  const config = loadConfig();

  // Initialize services
  const gongClient = new GongClient(
    config.gong.accessKey,
    config.gong.accessSecret,
    config.gong.baseUrl
  );
  const analyzer = new CompetitorAnalyzer(config.openai.apiKey);
  const emailService = new EmailService({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    user: config.email.user,
    pass: config.email.pass,
  });

  // Step 1: Get date range for past business week
  const dateRange = gongClient.getLastWeekDateRange();
  console.log(`📅 Date range: ${dateRange.fromDateTime} to ${dateRange.toDateTime}\n`);

  // Step 2: Fetch calls from Gong
  console.log("📞 Fetching calls from Gong...");
  const calls = await gongClient.getCalls(dateRange.fromDateTime, dateRange.toDateTime);

  if (calls.length === 0) {
    console.log("No calls found in the date range. Exiting.");
    return;
  }

  // Step 3: Fetch transcripts for all calls
  console.log("\n📝 Fetching transcripts...");
  const callIds = calls.map((c) => c.id);
  const transcripts = await gongClient.getTranscripts(callIds);

  // Create a map for easy lookup
  const transcriptMap = new Map(transcripts.map((t) => [t.callId, t]));

  // Step 4: Prepare calls for analysis
  const callsForAnalysis = calls.map((call) => {
    const transcript = transcriptMap.get(call.id);
    return {
      title: call.title,
      date: new Date(call.started).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      url: call.url,
      transcript: gongClient.formatCallWithTranscript(call, transcript),
    };
  });

  // Step 5: Analyze for competitor mentions
  console.log("\n🔍 Analyzing calls for competitor mentions...");
  const mentions = await analyzer.analyzeTranscripts(callsForAnalysis);

  // Step 6: Generate digest summary
  console.log("\n📊 Generating executive summary...");
  const digest = await analyzer.generateDigestSummary(
    mentions,
    {
      start: new Date(dateRange.fromDateTime).toLocaleDateString(),
      end: new Date(dateRange.toDateTime).toLocaleDateString(),
    },
    calls.length
  );

  // Step 7: Send email
  console.log("\n📧 Sending digest email...");
  await emailService.sendDigest(config.email.to, digest, config.email.from);

  console.log("\n✅ Competitive Intelligence Digest completed successfully!");
  console.log(`   - Analyzed ${digest.totalCallsAnalyzed} calls`);
  console.log(`   - Found ${digest.mentions.length} competitor mentions`);
  console.log(`   - Sent digest to ${config.email.to}`);
}

main().catch((error) => {
  console.error("❌ Error generating digest:", error);
  process.exit(1);
});


import nodemailer from "nodemailer";
import { NPIDoctor } from "./doctorLookup";

export interface DoctorRequestEmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export interface DoctorRequestData {
  doctorName: string;
  userEmail: string;
  userId?: string;
  userName?: string;
  submittedAt: Date;
  matchingDoctors: NPIDoctor[];
}

/**
 * Send email notification about a doctor information request
 */
export async function sendDoctorRequestNotification(
  data: DoctorRequestData,
  recipientEmail: string
): Promise<void> {
  const config = getEmailConfig();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  const subject = `🏥 Doctor Info Request: "${data.doctorName}" from ${data.userName || data.userEmail}`;
  const html = generateHtmlEmail(data);
  const text = generateTextEmail(data);

  await transporter.sendMail({
    from: config.user,
    to: recipientEmail,
    subject,
    text,
    html,
  });

  console.log(`Doctor request notification sent to ${recipientEmail}`);
}

function getEmailConfig(): DoctorRequestEmailConfig {
  return {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  };
}

function generateHtmlEmail(data: DoctorRequestData): string {
  const doctorRows =
    data.matchingDoctors.length > 0
      ? data.matchingDoctors
          .map(
            (doc) => `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 12px 8px;">
              <strong>${doc.name}</strong>${doc.credential ? `, ${doc.credential}` : ""}
            </td>
            <td style="padding: 12px 8px;">${doc.specialty}</td>
            <td style="padding: 12px 8px;">${doc.city}${doc.state ? `, ${doc.state}` : ""}</td>
            <td style="padding: 12px 8px; font-family: monospace; font-size: 12px;">${doc.npi}</td>
            <td style="padding: 12px 8px;">${doc.phone || "—"}</td>
          </tr>
        `
          )
          .join("")
      : `
          <tr>
            <td colspan="5" style="padding: 24px; text-align: center; color: #666;">
              No matching doctors found in NPI registry. The user may have misspelled the name or the doctor may not be in the US registry.
            </td>
          </tr>
        `;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  
  <div style="background: linear-gradient(135deg, #0f766e 0%, #115e59 100%); color: white; padding: 24px 30px; border-radius: 12px 12px 0 0;">
    <h1 style="margin: 0 0 8px 0; font-size: 24px;">🏥 Doctor Information Request</h1>
    <p style="margin: 0; opacity: 0.9;">A user has requested information about a doctor</p>
  </div>

  <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    
    <!-- Request Details -->
    <div style="background: #f0fdfa; border-left: 4px solid #0f766e; padding: 16px 20px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <h2 style="margin: 0 0 12px 0; color: #0f766e; font-size: 18px;">Request Details</h2>
      <table style="margin: 0;">
        <tr>
          <td style="padding: 4px 0; color: #666; width: 140px;">Doctor Name:</td>
          <td style="padding: 4px 0;"><strong style="font-size: 18px;">${escapeHtml(data.doctorName)}</strong></td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #666;">Requested By:</td>
          <td style="padding: 4px 0;">${data.userName ? `${escapeHtml(data.userName)} (${escapeHtml(data.userEmail)})` : escapeHtml(data.userEmail)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #666;">Submitted:</td>
          <td style="padding: 4px 0;">${data.submittedAt.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })}</td>
        </tr>
        ${data.userId ? `
        <tr>
          <td style="padding: 4px 0; color: #666;">User ID:</td>
          <td style="padding: 4px 0; font-family: monospace; font-size: 13px;">${escapeHtml(data.userId)}</td>
        </tr>
        ` : ""}
      </table>
    </div>

    <!-- Matching Doctors -->
    <h2 style="color: #1a1a2e; margin: 0 0 16px 0; font-size: 18px;">
      ${data.matchingDoctors.length > 0 
        ? `🔍 Potential Matches (${data.matchingDoctors.length} found)` 
        : "🔍 Potential Matches"}
    </h2>
    
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
            <th style="padding: 12px 8px; text-align: left; color: #475569;">Name</th>
            <th style="padding: 12px 8px; text-align: left; color: #475569;">Specialty</th>
            <th style="padding: 12px 8px; text-align: left; color: #475569;">Location</th>
            <th style="padding: 12px 8px; text-align: left; color: #475569;">NPI</th>
            <th style="padding: 12px 8px; text-align: left; color: #475569;">Phone</th>
          </tr>
        </thead>
        <tbody>
          ${doctorRows}
        </tbody>
      </table>
    </div>

    ${data.matchingDoctors.length > 0 ? `
    <p style="margin: 20px 0 0 0; font-size: 13px; color: #666;">
      💡 <strong>Tip:</strong> You can look up more details about any doctor by searching their NPI number at 
      <a href="https://npiregistry.cms.hhs.gov/" style="color: #0f766e;">npiregistry.cms.hhs.gov</a>
    </p>
    ` : ""}

    <!-- Footer -->
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
      <p style="margin: 0;">This notification was triggered by a Userflow popup submission.</p>
    </div>
  </div>
</body>
</html>
  `;
}

function generateTextEmail(data: DoctorRequestData): string {
  let text = `DOCTOR INFORMATION REQUEST
${"=".repeat(50)}

REQUEST DETAILS
---------------
Doctor Name: ${data.doctorName}
Requested By: ${data.userName ? `${data.userName} (${data.userEmail})` : data.userEmail}
Submitted: ${data.submittedAt.toLocaleString()}
${data.userId ? `User ID: ${data.userId}` : ""}

POTENTIAL MATCHES
-----------------
`;

  if (data.matchingDoctors.length === 0) {
    text += "No matching doctors found in NPI registry.\n";
  } else {
    text += `Found ${data.matchingDoctors.length} potential match(es):\n\n`;
    for (const doc of data.matchingDoctors) {
      text += `• ${doc.name}${doc.credential ? `, ${doc.credential}` : ""}\n`;
      text += `  Specialty: ${doc.specialty}\n`;
      text += `  Location: ${doc.city}${doc.state ? `, ${doc.state}` : ""}\n`;
      text += `  NPI: ${doc.npi}\n`;
      if (doc.phone) text += `  Phone: ${doc.phone}\n`;
      text += "\n";
    }
  }

  text += `
${"=".repeat(50)}
This notification was triggered by a Userflow popup submission.
`;

  return text;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

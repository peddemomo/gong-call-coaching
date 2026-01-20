/**
 * Email Sending Service
 *
 * Sends coaching emails using Resend and a formatted HTML template.
 * Currently hardcoded to send to test email - DO NOT send to actual recipients yet.
 */

import { Resend } from "resend";

// IMPORTANT: Hardcoded test email - DO NOT send to actual recipients yet
const TEST_EMAIL_RECIPIENT = "ljpeddemo@gmail.com";

// Resend configuration
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "Coaching <onboarding@resend.dev>";

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!RESEND_API_KEY) {
    throw new Error(
      "Missing Resend API key. Set RESEND_API_KEY environment variable."
    );
  }

  if (!resendClient) {
    resendClient = new Resend(RESEND_API_KEY);
  }

  return resendClient;
}

export interface SendEmailInput {
  recipientEmail: string; // The actual recipient (stored for reference, but NOT used yet)
  callTitle: string;
  coachingBody: string; // The raw coaching text from OpenAI
  subject: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  sentTo: string; // The email it was actually sent to
}

/**
 * Convert markdown-style coaching text to HTML
 */
function formatCoachingToHtml(coachingText: string): string {
  // Convert **bold** to <strong>
  let cleaned = String(coachingText).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  const lines = cleaned.split("\n");

  const coachingHtml = lines
    .map((l) => {
      // Numbered list items
      if (/^\d+\.\s/.test(l)) {
        const numMatch = l.match(/^\d+\./);
        const num = numMatch ? numMatch[0] : "";
        const rest = l.replace(/^\d+\.\s/, "");
        return `<p style="margin:12px 0;"><strong>${num}</strong> ${rest}</p>`;
      }
      // Empty lines become breaks
      if (l.trim() === "") return "<br/>";
      // Regular paragraphs
      return `<p style="margin:8px 0;">${l}</p>`;
    })
    .join("");

  return coachingHtml;
}

/**
 * Build the full HTML email using the template
 */
function buildEmailHtml(callTitle: string, coachingHtml: string): string {
  const template = `
<!DOCTYPE html><html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="UTF-8" /><meta http-equiv="Content-Type" content="text/html; charset=utf-8" /><!--[if !mso]><!-- --><meta http-equiv="X-UA-Compatible" content="IE=edge" /><!--<![endif]--><meta name="viewport" content="width=device-width, initial-scale=1.0" /><meta name="format-detection" content="telephone=no, date=no, address=no, email=no" /><meta name="x-apple-disable-message-reformatting" /><link href="https://fonts.googleapis.com/css?family=IBM+Plex+Sans:ital,wght@0,400" rel="stylesheet" /><title>Racoon.ai</title><!-- Made with Postcards Email Builder by Designmodo --><style>html,body{margin:0 !important;padding:0 !important;min-height:100% !important;width:100% !important;-webkit-font-smoothing:antialiased;}*{-ms-text-size-adjust:100%;}#outlook a{padding:0;}.ReadMsgBody,.ExternalClass{width:100%;}.ExternalClass,.ExternalClass p,.ExternalClass td,.ExternalClass div,.ExternalClass span,.ExternalClass font{line-height:100%;}table,td,th{mso-table-lspace:0 !important;mso-table-rspace:0 !important;border-collapse:collapse;}u + .body table,u + .body td,u + .body th{will-change:transform;}body,td,th,p,div,li,a,span{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;mso-line-height-rule:exactly;}img{border:0;outline:0;line-height:100%;text-decoration:none;-ms-interpolation-mode:bicubic;}a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important;}.body .pc-project-body{background-color:transparent !important;}@media (min-width:621px){.pc-lg-hide{display:none;}.pc-lg-bg-img-hide{background-image:none !important;}}</style><style>@media (max-width:620px){.pc-project-body{min-width:0 !important;}.pc-project-container,.pc-component{width:100% !important;}.pc-sm-hide{display:none !important;}.pc-sm-bg-img-hide{background-image:none !important;}.pc-w620-itemsVSpacings-30{padding-top:15px !important;padding-bottom:15px !important;}.pc-w620-itemsHSpacings-0{padding-left:0 !important;padding-right:0 !important;}.pc-w620-valign-middle{vertical-align:middle !important;}td.pc-w620-halign-left,th.pc-w620-halign-left{text-align:left !important;text-align-last:left !important;}table.pc-w620-halign-left{float:none !important;margin-right:auto !important;margin-left:0 !important;}img.pc-w620-halign-left{margin-right:auto !important;margin-left:0 !important;}.pc-w620-width-100pc{width:100% !important;}.pc-w620-height-auto{height:auto !important;}.pc-w620-text-align-left{text-align:left !important;text-align-last:left !important;}.pc-w620-padding-30-30-30-30{padding:30px !important;}table.pc-w620-spacing-0-0-15-0{margin:0 0 15px !important;}td.pc-w620-spacing-0-0-15-0,th.pc-w620-spacing-0-0-15-0{margin:0 !important;padding:0 0 15px !important;}table.pc-w620-spacing-0-0-0-0{margin:0 !important;}td.pc-w620-spacing-0-0-0-0,th.pc-w620-spacing-0-0-0-0{margin:0 !important;padding:0 !important;}.pc-w620-font-size-16px{font-size:16px !important;}.pc-g-ib{display:inline-block !important;}.pc-g-b{display:block !important;}.pc-g-rb{display:block !important;width:auto !important;}.pc-g-wf{width:100% !important;}.pc-g-rpt{padding-top:0 !important;}.pc-g-rpr{padding-right:0 !important;}.pc-g-rpb{padding-bottom:0 !important;}.pc-g-rpl{padding-left:0 !important;}}</style><!--[if !mso]><!-- --><style>@font-face{font-family:'IBM Plex Sans';font-style:normal;font-weight:400;src:url('https://fonts.gstatic.com/l/font?kit=zYXGKVElMYYaJe8bpLHnCwDKr932-G7dytD-Dmu1swZSAXcomDVmadSD6llDCag-&skey=db4d85f0f9937532&v=v23') format('woff'),url('https://fonts.gstatic.com/s/ibmplexsans/v23/zYXGKVElMYYaJe8bpLHnCwDKr932-G7dytD-Dmu1swZSAXcomDVmadSD6llDCag4.woff2') format('woff2');}</style><!--<![endif]--><!--[if mso]><style type="text/css">.pc-font-alt{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]--><!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]--></head><body class="body pc-font-alt" style="width:100% !important;min-height:100% !important;margin:0 !important;padding:0 !important;mso-line-height-rule:exactly;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;font-variant-ligatures:normal;text-rendering:optimizeLegibility;-moz-osx-font-smoothing:grayscale;background-color:#f8f7ff" bgcolor="#f8f7ff"><table class="pc-project-body" style="table-layout:fixed;width:100%;min-width:600px;background-color:#f8f7ff" bgcolor="#f8f7ff" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td align="center" valign="top" style="width:auto"><table class="pc-project-container" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="padding:20px 0" align="left" valign="top"><table class="pc-component" style="width:600px;max-width:600px" width="600" align="center" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td class="pc-w620-spacing-0-0-15-0" style="padding:0 0 15px" width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation"><table width="100%" align="center" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><!--[if !gte mso 9]><!-- --><td valign="top" class="pc-w620-padding-30-30-30-30" style="background-image:url('https://cloudfilesdm.com/postcards/Group_1__61-68495576.png');background-size:cover;background-position:center right;background-repeat:no-repeat;padding:50px 48px;height:unset;border-radius:10px 10px 10px 10px;background-color:#ffb800" bgcolor="#ffb800" background="https://cloudfilesdm.com/postcards/Group_1__61-68495576.png"><!--<![endif]--><!--[if gte mso 9]><td valign="top" align="center" style="background-image:url('https://cloudfilesdm.com/postcards/Group_1__61-68495576.png');background-size:cover;background-position:center right;background-repeat:no-repeat;background-color:#ffb800;border-radius:10px 10px 10px 10px" bgcolor="#ffb800" background="https://cloudfilesdm.com/postcards/Group_1__61-68495576.png"><![endif]--><!--[if gte mso 9]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px"><v:fill src="https://cloudfilesdm.com/postcards/Group_1__61-68495576.png" color="#ffb800" type="frame" size="1,1" aspect="atleast"/><v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0"><div style="font-size:0;line-height:0"><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="font-size:14px;line-height:1.5" valign="top"><p style="margin:0;mso-hide:all"><o:p xmlns:o="urn:schemas-microsoft-com:office:office">&nbsp;</o:p></p><table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td colspan="3" height="50" style="line-height:1px;font-size:1px">&nbsp;</td></tr><tr><td width="48" valign="top" style="line-height:1px;font-size:1px">&nbsp;</td><td valign="top" align="left"><![endif]--><table class="pc-width-fill" width="100%" height="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tbody><tr><td class="pc-g-rpt pc-g-rpb pc-w620-itemsVSpacings-30" align="left" valign="middle" style="padding-top:0;padding-bottom:0"><table style="width:100%;height:100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td class="pc-w620-halign-left pc-w620-valign-middle" align="left" valign="middle" style="padding:50px 0;height:auto"><table class="pc-w620-halign-left" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td class="pc-w620-halign-left" align="left" valign="top"><table class="pc-w620-halign-left pc-w620-width-100pc" width="65%" align="left" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td valign="top"><table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" align="left"><tr><td valign="top" align="left"><div class="pc-font-alt" style="text-decoration:none"><div style="font-size:36px;line-height:128%;text-align:left;text-align-last:left;color:#000;font-family:'IBM Plex Sans',Arial,Helvetica,sans-serif;font-style:normal;letter-spacing:-0.6px"><div style="font-family:'IBM Plex Sans',Arial,Helvetica,sans-serif" class="pc-w620-text-align-left"><span style="font-family:'IBM Plex Sans',Arial,Helvetica,sans-serif;font-weight:700;font-size:36px;line-height:128%">{{call_title}} product positioning recommendations</span></div></div></div></td></tr></table></td></tr></table></td></tr></table></td></tr></table></td></tr></tbody></table><!--[if gte mso 9]></td><td width="48" style="line-height:1px;font-size:1px" valign="top">&nbsp;</td></tr><tr><td colspan="3" height="50" style="line-height:1px;font-size:1px">&nbsp;</td></tr></table></td></tr></table></div><p style="margin:0;mso-hide:all"><o:p xmlns:o="urn:schemas-microsoft-com:office:office">&nbsp;</o:p></p></v:textbox></v:rect><![endif]--></td></tr></table></td></tr></table><table class="pc-component" style="width:600px;max-width:600px" width="600" align="center" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td class="pc-w620-spacing-0-0-0-0" width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation"><table width="100%" align="center" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td valign="top" class="pc-w620-padding-30-30-30-30" style="padding:48px;height:unset;border-radius:10px 10px 0 0;background-color:#fff" bgcolor="#ffffff"><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="left" valign="top" style="padding:0 0 8px;height:auto"><table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" align="left"><tr><td valign="top" align="left"><div class="pc-font-alt" style="text-decoration:none"><div style="font-size:14px;line-height:150%;text-align:left;text-align-last:left;color:#28243d;font-family:'IBM Plex Sans',Arial,Helvetica,sans-serif;letter-spacing:-0.2px;font-style:normal"><div style="font-family:'IBM Plex Sans',Arial,Helvetica,sans-serif"><span style="font-family:'IBM Plex Sans',Arial,Helvetica,sans-serif;font-size:14px;line-height:150%;font-weight:400">{{coaching_html}}</span></div></div></div></td></tr></table></td></tr></table></td></tr></table></td></tr></table><table class="pc-component" style="width:600px;max-width:600px" width="600" align="center" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td class="pc-w620-spacing-0-0-0-0" width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation"><table width="100%" align="center" border="0" cellspacing="0" cellpadding="0" role="presentation"><tr><td valign="top" class="pc-w620-padding-30-30-30-30" style="padding:48px;height:unset;background-color:#ff830042" bgcolor="#ff8300"><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="left" valign="top" style="padding:0 0 24px;height:auto"><table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" align="left"><tr><td valign="top" align="left"><div class="pc-font-alt" style="text-decoration:none"><div class="pc-w620-font-size-16px" style="font-size:15px;line-height:150%;text-align:left;text-align-last:left;color:#28243d;font-family:'IBM Plex Sans',Arial,Helvetica,sans-serif;letter-spacing:0;font-style:normal"><div style="font-family:'IBM Plex Sans',Arial,Helvetica,sans-serif" class="pc-w620-text-align-left"><span style="font-family:'IBM Plex Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:150%;font-weight:400" class="pc-w620-font-size-16px">Please note that AI was used to generate these recommendations. AI can be prone to hallucination and lack of focus, so&nbsp;&nbsp;don't assume everything in this email is perfect truth.</span></div></div></div></td></tr></table></td></tr></table></td></tr></table></td></tr></table><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" valign="top" style="padding-top:20px;padding-bottom:20px;vertical-align:top"><a href="https://postcards.email/?uid=MzMyMzAz&type=footer" target="_blank" style="text-decoration:none;overflow:hidden;border-radius:2px;display:inline-block"><img src="https://cloudfilesdm.com/postcards/promo-footer-dark.jpg" width="198" height="46" alt="Made with (o -) postcards" style="width:198px;height:auto;margin:0 auto;border:0;outline:0;line-height:100%;-ms-interpolation-mode:bicubic;vertical-align:top"></a><img src="https://api-postcards.designmodo.com/tracking/mail/promo?uid=MzMyMzAz" width="1" height="1" alt="" style="display:none;width:1px;height:1px"></td></tr></table></td></tr></table></td></tr></table></body></html>
`;

  // Replace placeholders
  const html = template
    .replace(/{{call_title}}/g, callTitle)
    .replace(/{{coaching_html}}/g, coachingHtml);

  return html;
}

/**
 * Send a coaching email
 *
 * IMPORTANT: Currently sends to TEST_EMAIL_RECIPIENT only.
 * The actual recipientEmail is stored for reference but NOT used.
 */
export async function sendCoachingEmail(
  input: SendEmailInput
): Promise<SendEmailResult> {
  const { recipientEmail, callTitle, coachingBody, subject } = input;

  try {
    const resend = getResendClient();

    // Convert coaching markdown to HTML
    const coachingHtml = formatCoachingToHtml(coachingBody);

    // Build full email HTML
    const htmlContent = buildEmailHtml(callTitle, coachingHtml);

    console.log(
      `[Email] Sending to TEST email (${TEST_EMAIL_RECIPIENT}) - actual recipient would be: ${recipientEmail}`
    );

    // IMPORTANT: Send to test email, NOT the actual recipient
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: TEST_EMAIL_RECIPIENT, // <-- HARDCODED TEST EMAIL
      subject: subject,
      html: htmlContent,
    });

    if (error) {
      console.error("[Email] Resend error:", error);
      return {
        success: false,
        error: error.message,
        sentTo: TEST_EMAIL_RECIPIENT,
      };
    }

    console.log(`[Email] Sent successfully. MessageId: ${data?.id}`);

    return {
      success: true,
      messageId: data?.id,
      sentTo: TEST_EMAIL_RECIPIENT,
    };
  } catch (error) {
    console.error("[Email] Failed to send:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      sentTo: TEST_EMAIL_RECIPIENT,
    };
  }
}

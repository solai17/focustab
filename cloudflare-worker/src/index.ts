/**
 * ByteLetters - Cloudflare Email Worker
 *
 * This worker receives emails via Cloudflare Email Routing and forwards
 * them to the ByteLetters backend API for processing.
 */

export interface Env {
  API_URL: string;
  WEBHOOK_SECRET?: string;
}

export default {
  async email(message: EmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
    const apiUrl = env.API_URL || 'https://api.byteletters.app';
    const webhookUrl = `${apiUrl}/webhooks/cloudflare`;

    try {
      // Read the raw email content
      const rawEmail = await streamToText(message.raw);

      // Parse email content
      const { htmlContent, textContent } = parseEmailContent(rawEmail);

      // Extract sender name from the "from" header
      const senderName = extractSenderName(message.from);

      // Prepare payload for backend
      const payload = {
        recipient: message.to,
        sender: message.from,
        senderName: senderName,
        subject: message.headers.get('subject') || 'No Subject',
        htmlContent: htmlContent,
        textContent: textContent,
        receivedAt: new Date().toISOString(),
        messageId: message.headers.get('message-id') || '',
      };

      console.log(`Processing email from ${message.from} to ${message.to}`);

      // Send to backend
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add webhook secret if configured
      if (env.WEBHOOK_SECRET) {
        headers['X-Webhook-Secret'] = env.WEBHOOK_SECRET;
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log(`Backend response: ${response.status} - ${responseText}`);

      if (!response.ok) {
        console.error(`Backend error: ${response.status} - ${responseText}`);
        // Don't throw - we still want to accept the email
      }
    } catch (error) {
      console.error('Email processing error:', error);
      // Don't throw - accept the email even if processing fails
      // This prevents Cloudflare from marking it as "Dropped"
    }
  },
};

/**
 * Convert a ReadableStream to text
 */
async function streamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }

  result += decoder.decode(); // Flush any remaining bytes
  return result;
}

/**
 * Parse email content to extract HTML and text parts
 */
function parseEmailContent(rawEmail: string): { htmlContent: string; textContent: string } {
  let htmlContent = '';
  let textContent = '';

  // Check if it's a multipart email
  const boundaryMatch = rawEmail.match(/boundary="?([^"\r\n]+)"?/i);

  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = rawEmail.split(`--${boundary}`);

    for (const part of parts) {
      const contentTypeMatch = part.match(/Content-Type:\s*([^;\r\n]+)/i);
      if (!contentTypeMatch) continue;

      const contentType = contentTypeMatch[1].toLowerCase();

      // Find the content after headers (separated by double newline)
      const contentMatch = part.match(/\r?\n\r?\n([\s\S]*)/);
      if (!contentMatch) continue;

      let content = contentMatch[1].trim();

      // Check for content transfer encoding
      const encodingMatch = part.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i);
      if (encodingMatch) {
        const encoding = encodingMatch[1].toLowerCase().trim();
        if (encoding === 'base64') {
          try {
            content = atob(content.replace(/\s/g, ''));
          } catch (e) {
            console.error('Base64 decode error:', e);
          }
        } else if (encoding === 'quoted-printable') {
          content = decodeQuotedPrintable(content);
        }
      }

      if (contentType.includes('text/html')) {
        htmlContent = content;
      } else if (contentType.includes('text/plain')) {
        textContent = content;
      }
    }
  } else {
    // Simple email without multipart
    const contentMatch = rawEmail.match(/\r?\n\r?\n([\s\S]*)/);
    if (contentMatch) {
      const body = contentMatch[1].trim();

      // Check if it looks like HTML
      if (body.includes('<html') || body.includes('<body') || body.includes('<p>')) {
        htmlContent = body;
        textContent = stripHtml(body);
      } else {
        textContent = body;
      }
    }
  }

  // If we only have HTML, extract text from it
  if (htmlContent && !textContent) {
    textContent = stripHtml(htmlContent);
  }

  return { htmlContent, textContent };
}

/**
 * Decode quoted-printable encoding
 */
function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, '') // Remove soft line breaks
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Strip HTML tags to get plain text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract display name from email address
 */
function extractSenderName(from: string): string {
  // Handle format: "Name" <email@example.com> or Name <email@example.com>
  const nameMatch = from.match(/^"?([^"<]+)"?\s*</);
  if (nameMatch) {
    return nameMatch[1].trim();
  }

  // If no name, use the part before @ in the email
  const emailMatch = from.match(/<?([^@<]+)@/);
  if (emailMatch) {
    return emailMatch[1].trim();
  }

  return from;
}

/**
 * Type definition for Cloudflare Email Message
 */
interface EmailMessage {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream<Uint8Array>;
  readonly rawSize: number;
  setReject(reason: string): void;
  forward(rcptTo: string, headers?: Headers): Promise<void>;
}

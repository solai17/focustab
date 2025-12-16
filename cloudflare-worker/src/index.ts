// Cloudflare Email Worker for ByteLetters
// This worker receives emails, parses them, and forwards to the backend API

import PostalMime from 'postal-mime';

export interface Env {
    // Your backend API URL
    API_URL: string;
    // Optional: shared secret for webhook authentication
    WEBHOOK_SECRET?: string;
}

export default {
    async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
        try {
            // Get basic email info from headers
            const recipientEmail = message.to.toLowerCase();
            const senderEmail = message.from.toLowerCase();
            const subject = message.headers.get('subject') || 'No Subject';

            console.log(`Processing email from ${senderEmail} to ${recipientEmail}`);

            // Parse the full email content
            const rawEmail = await streamToArrayBuffer(message.raw);
            const parser = new PostalMime();
            const parsed = await parser.parse(rawEmail);

            // Extract content (prefer HTML, fallback to text)
            const htmlContent = parsed.html || '';
            const textContent = parsed.text || '';

            // Extract sender name from "From" header
            const fromHeader = message.headers.get('from') || senderEmail;
            const senderName = extractSenderName(fromHeader);

            // Prepare payload for backend
            const payload = {
                recipient: recipientEmail,
                sender: senderEmail,
                senderName: senderName,
                subject: subject,
                htmlContent: htmlContent,
                textContent: textContent,
                receivedAt: new Date().toISOString(),
            };

            // Forward to backend API
            const apiUrl = env.API_URL || 'https://api.byteletters.app';
            const webhookUrl = `${apiUrl}/webhooks/cloudflare`;

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

            // Add authentication if secret is configured
            if (env.WEBHOOK_SECRET) {
                headers['X-Webhook-Secret'] = env.WEBHOOK_SECRET;
            }

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Backend API error: ${response.status} - ${errorText}`);
                // Don't throw - we don't want to reject the email
            } else {
                const result = await response.json();
                console.log(`Email processed successfully:`, result);
            }
        } catch (error) {
            console.error('Error processing email:', error);
            // Log but don't throw - accept the email even if processing fails
        }
    },
};

/**
 * Convert a ReadableStream to ArrayBuffer
 */
async function streamToArrayBuffer(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
    }

    // Concatenate all chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }

    return result.buffer;
}

/**
 * Extract sender name from "From" header
 * Handles formats like: "Name <email@domain.com>" or just "email@domain.com"
 */
function extractSenderName(from: string): string {
    // Format: "Name <email@domain.com>" or just "email@domain.com"
    const match = from.match(/^"?([^"<]+)"?\s*<?/);
    if (match && match[1]) {
        return match[1].trim();
    }
    return from.split('@')[0];
}

import { Router, Request, Response } from 'express';
import multer from 'multer';
import prisma from '../services/db';
import { processNewsletterWithClaude } from '../services/claude';
import { verifyMailgunSignature, htmlToText, extractSenderName } from '../services/utils';
import { MailgunWebhookPayload } from '../types';

const router = Router();
const upload = multer();

const MAILGUN_SIGNING_KEY = process.env.MAILGUN_WEBHOOK_SIGNING_KEY || '';

/**
 * POST /webhooks/mailgun
 * Receive incoming emails from Mailgun
 */
router.post('/mailgun', upload.none(), async (req: Request, res: Response) => {
  try {
    const payload = req.body as MailgunWebhookPayload;

    // Verify webhook signature (skip in development)
    if (process.env.NODE_ENV === 'production' && MAILGUN_SIGNING_KEY) {
      const isValid = verifyMailgunSignature(
        payload.timestamp,
        payload.token,
        payload.signature,
        MAILGUN_SIGNING_KEY
      );

      if (!isValid) {
        console.warn('Invalid Mailgun webhook signature');
        res.status(403).json({ error: 'Invalid signature' });
        return;
      }
    }

    // Extract recipient inbox email
    const recipientEmail = payload.recipient.toLowerCase();
    
    // Find user by inbox email
    const user = await prisma.user.findUnique({
      where: { inboxEmail: recipientEmail },
    });

    if (!user) {
      console.warn(`No user found for inbox: ${recipientEmail}`);
      // Still return 200 to prevent Mailgun retries
      res.status(200).json({ message: 'Recipient not found, email discarded' });
      return;
    }

    // Extract content
    const htmlContent = payload['body-html'] || payload['stripped-html'] || '';
    const textContent = payload['body-plain'] || payload['stripped-text'] || htmlToText(htmlContent);
    const senderName = extractSenderName(payload.from);

    // Create newsletter record
    const newsletter = await prisma.newsletter.create({
      data: {
        userId: user.id,
        senderEmail: payload.sender,
        senderName,
        subject: payload.subject || 'No Subject',
        rawContent: htmlContent,
        textContent,
        isProcessed: false,
      },
    });

    console.log(`Newsletter received: ${newsletter.id} for user ${user.id}`);

    // Process with Claude asynchronously
    processNewsletterAsync(newsletter.id, payload.subject, textContent, senderName);

    res.status(200).json({ 
      message: 'Email received',
      newsletterId: newsletter.id,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    // Return 200 to prevent Mailgun retries on our errors
    res.status(200).json({ error: 'Processing error' });
  }
});

/**
 * Process newsletter with Claude in the background
 */
async function processNewsletterAsync(
  newsletterId: string,
  subject: string,
  textContent: string,
  senderName: string
): Promise<void> {
  try {
    console.log(`Processing newsletter ${newsletterId} with Claude...`);

    const processed = await processNewsletterWithClaude(subject, textContent, senderName);

    // Update newsletter with processed content
    const newsletter = await prisma.newsletter.update({
      where: { id: newsletterId },
      data: {
        summary: processed.summary,
        keyInsight: processed.keyInsight,
        readTimeMinutes: processed.readTimeMinutes,
        isProcessed: true,
        processedAt: new Date(),
      },
    });

    // Create inspirations
    if (processed.inspirations.length > 0) {
      await prisma.inspiration.createMany({
        data: processed.inspirations.map((insp) => ({
          userId: newsletter.userId,
          newsletterId: newsletter.id,
          quote: insp.quote,
          author: insp.author || senderName,
          source: senderName,
          category: 'wisdom',
        })),
      });
    }

    console.log(`Newsletter ${newsletterId} processed successfully`);
  } catch (error) {
    console.error(`Failed to process newsletter ${newsletterId}:`, error);

    // Mark as processed but with error state
    await prisma.newsletter.update({
      where: { id: newsletterId },
      data: {
        isProcessed: true,
        summary: 'Failed to process newsletter content.',
        processedAt: new Date(),
      },
    });
  }
}

/**
 * POST /webhooks/test
 * Test endpoint to manually add a newsletter (for development)
 */
router.post('/test', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  try {
    const { inboxEmail, subject, content, senderName } = req.body;

    if (!inboxEmail || !subject || !content) {
      res.status(400).json({ error: 'inboxEmail, subject, and content required' });
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { inboxEmail },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found for inbox email' });
      return;
    }

    // Create newsletter
    const newsletter = await prisma.newsletter.create({
      data: {
        userId: user.id,
        senderEmail: 'test@example.com',
        senderName: senderName || 'Test Sender',
        subject,
        rawContent: content,
        textContent: content,
        isProcessed: false,
      },
    });

    // Process
    await processNewsletterAsync(newsletter.id, subject, content, senderName || 'Test Sender');

    res.json({ 
      message: 'Test newsletter created',
      newsletterId: newsletter.id,
    });
  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({ error: 'Failed to create test newsletter' });
  }
});

export default router;

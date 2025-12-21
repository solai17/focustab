import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { prisma } from '../services/db';
import { categorizeNewsletterSource } from '../services/claude';
import { verifyMailgunSignature, htmlToText, extractSenderName } from '../services/utils';
import { MailgunWebhookPayload } from '../types';

const router = Router();
const upload = multer();

const MAILGUN_SIGNING_KEY = process.env.MAILGUN_WEBHOOK_SIGNING_KEY || '';
const CLOUDFLARE_WEBHOOK_SECRET = process.env.CLOUDFLARE_WEBHOOK_SECRET || '';

// =============================================================================
// CLOUDFLARE EMAIL WORKER WEBHOOK
// =============================================================================

/**
 * POST /webhooks/cloudflare
 * Receive incoming emails from Cloudflare Email Workers
 */
router.post('/cloudflare', async (req: Request, res: Response) => {
  try {
    const {
      recipient,
      sender,
      senderName,
      subject,
      htmlContent,
      textContent,
      receivedAt,
    } = req.body;

    // Verify webhook secret if configured
    if (CLOUDFLARE_WEBHOOK_SECRET) {
      const providedSecret = req.headers['x-webhook-secret'];
      if (providedSecret !== CLOUDFLARE_WEBHOOK_SECRET) {
        console.warn('Invalid Cloudflare webhook secret');
        res.status(403).json({ error: 'Invalid webhook secret' });
        return;
      }
    }

    // Validate required fields
    if (!recipient || !sender) {
      res.status(400).json({ error: 'recipient and sender are required' });
      return;
    }

    const recipientEmail = recipient.toLowerCase();
    const senderEmail = sender.toLowerCase();
    const finalSubject = subject || 'No Subject';
    const finalSenderName = senderName || extractSenderName(sender);
    const finalTextContent = textContent || htmlToText(htmlContent || '');

    console.log(`[Cloudflare] Email from ${senderEmail} to ${recipientEmail}`);

    // Find user by inbox email
    const user = await prisma.user.findUnique({
      where: { inboxEmail: recipientEmail },
    });

    if (!user) {
      console.warn(`[Cloudflare] No user found for inbox: ${recipientEmail}`);
      res.status(200).json({ message: 'Recipient not found, email discarded' });
      return;
    }

    // Generate content hash for deduplication
    const contentHash = generateContentHash(finalSubject, finalTextContent);

    // Check if this edition already exists (deduplication)
    const existingEdition = await prisma.edition.findUnique({
      where: { contentHash },
      include: { source: true },
    });

    if (existingEdition) {
      await ensureUserSubscription(user.id, existingEdition.sourceId, 'forwarded');
      console.log(`[Cloudflare] Duplicate edition: ${existingEdition.id}`);

      res.status(200).json({
        message: 'Email received (duplicate edition)',
        editionId: existingEdition.id,
        isDuplicate: true,
      });
      return;
    }

    // Find or create newsletter source
    const source = await findOrCreateSource(senderEmail, finalSenderName, finalTextContent);

    // Create new edition with pending status (will be processed by queue)
    const edition = await prisma.edition.create({
      data: {
        sourceId: source.id,
        subject: finalSubject,
        contentHash,
        rawContent: htmlContent || '',
        textContent: finalTextContent,
        isProcessed: false,
        processingStatus: 'pending', // Queue for batch processing
        processAttempts: 0,
      },
    });

    // Link user to source
    await ensureUserSubscription(user.id, source.id, 'forwarded');

    console.log(`[Cloudflare] New edition queued: ${edition.id} for source ${source.name}`);

    res.status(200).json({
      message: 'Email received',
      editionId: edition.id,
      sourceId: source.id,
    });
  } catch (error) {
    console.error('[Cloudflare] Webhook error:', error);
    res.status(200).json({ error: 'Processing error' });
  }
});

// =============================================================================
// MAILGUN WEBHOOK
// =============================================================================

/**
 * POST /webhooks/mailgun
 * Receive incoming emails from Mailgun
 * v2.0: Uses shared content model - deduplicates newsletters across users
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
      res.status(200).json({ message: 'Recipient not found, email discarded' });
      return;
    }

    // Extract content
    const htmlContent = payload['body-html'] || payload['stripped-html'] || '';
    const textContent = payload['body-plain'] || payload['stripped-text'] || htmlToText(htmlContent);
    const senderEmail = payload.sender.toLowerCase();
    const senderName = extractSenderName(payload.from);
    const subject = payload.subject || 'No Subject';

    // Generate content hash for deduplication
    const contentHash = generateContentHash(subject, textContent);

    // Check if this edition already exists (deduplication)
    const existingEdition = await prisma.edition.findUnique({
      where: { contentHash },
      include: { source: true },
    });

    if (existingEdition) {
      // Edition exists - just link user to source if not already subscribed
      await ensureUserSubscription(user.id, existingEdition.sourceId, 'forwarded');
      console.log(`Duplicate edition detected: ${existingEdition.id}, linked user ${user.id}`);

      res.status(200).json({
        message: 'Email received (duplicate edition)',
        editionId: existingEdition.id,
        isDuplicate: true,
      });
      return;
    }

    // Find or create newsletter source
    const source = await findOrCreateSource(senderEmail, senderName, textContent);

    // Create new edition with pending status (will be processed by queue)
    const edition = await prisma.edition.create({
      data: {
        sourceId: source.id,
        subject,
        contentHash,
        rawContent: htmlContent,
        textContent,
        isProcessed: false,
        processingStatus: 'pending', // Queue for batch processing
        processAttempts: 0,
      },
    });

    // Link user to source
    await ensureUserSubscription(user.id, source.id, 'forwarded');

    console.log(`[Mailgun] New edition queued: ${edition.id} for source ${source.name}`);

    res.status(200).json({
      message: 'Email received',
      editionId: edition.id,
      sourceId: source.id,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).json({ error: 'Processing error' });
  }
});


// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a hash for content deduplication
 */
function generateContentHash(subject: string, content: string): string {
  const normalizedContent = content.slice(0, 1000).toLowerCase().replace(/\s+/g, ' ');
  return crypto
    .createHash('sha256')
    .update(`${subject}|${normalizedContent}`)
    .digest('hex');
}

/**
 * Find existing source or create new one
 */
async function findOrCreateSource(
  senderEmail: string,
  senderName: string,
  sampleContent: string
) {
  // Try to find existing source by sender email
  let source = await prisma.newsletterSource.findUnique({
    where: { senderEmail },
  });

  if (source) {
    return source;
  }

  // Extract domain for grouping
  const senderDomain = senderEmail.split('@')[1] || 'unknown';

  // Use Claude to categorize the newsletter
  const categorization = await categorizeNewsletterSource(senderName, sampleContent);

  // Create new source
  source = await prisma.newsletterSource.create({
    data: {
      name: senderName || senderEmail,
      senderEmail,
      senderDomain,
      description: categorization.description,
      category: categorization.category,
      tags: categorization.tags,
    },
  });

  console.log(`New newsletter source created: ${source.name} (${source.category})`);
  return source;
}

/**
 * Ensure user is subscribed to a source
 */
async function ensureUserSubscription(
  userId: string,
  sourceId: string,
  discoveryMethod: string
) {
  await prisma.userSubscription.upsert({
    where: { userId_sourceId: { userId, sourceId } },
    create: { userId, sourceId, discoveryMethod },
    update: { isActive: true },
  });

  // Update subscriber count
  await prisma.newsletterSource.update({
    where: { id: sourceId },
    data: { subscriberCount: { increment: 1 } },
  });
}

// =============================================================================
// TEST ENDPOINTS
// =============================================================================

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
    const { inboxEmail, subject, content, senderName, senderEmail } = req.body;

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

    const finalSenderEmail = senderEmail || 'test@example.com';
    const finalSenderName = senderName || 'Test Sender';

    // Generate content hash
    const contentHash = generateContentHash(subject, content);

    // Find or create source
    const source = await findOrCreateSource(finalSenderEmail, finalSenderName, content);

    // Create edition with pending status (queued for processing)
    const edition = await prisma.edition.create({
      data: {
        sourceId: source.id,
        subject,
        contentHash,
        rawContent: content,
        textContent: content,
        isProcessed: false,
        processingStatus: 'pending',
        processAttempts: 0,
      },
    });

    // Link user
    await ensureUserSubscription(user.id, source.id, 'test');

    res.json({
      message: 'Test newsletter queued for processing',
      editionId: edition.id,
      sourceId: source.id,
      status: 'pending',
    });
  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({ error: 'Failed to create test newsletter' });
  }
});

/**
 * POST /webhooks/test-byte
 * Create a test content byte directly (for UI testing)
 */
router.post('/test-byte', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  try {
    const { content, type, author, category, sourceName } = req.body;

    if (!content) {
      res.status(400).json({ error: 'content required' });
      return;
    }

    // Find or create a test source
    let source = await prisma.newsletterSource.findFirst({
      where: { name: sourceName || 'Test Newsletter' },
    });

    if (!source) {
      source = await prisma.newsletterSource.create({
        data: {
          name: sourceName || 'Test Newsletter',
          senderEmail: 'test@test.com',
          senderDomain: 'test.com',
          category: category || 'general',
        },
      });
    }

    // Find or create a test edition
    let edition = await prisma.edition.findFirst({
      where: { sourceId: source.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!edition) {
      edition = await prisma.edition.create({
        data: {
          sourceId: source.id,
          subject: 'Test Edition',
          contentHash: `test-${Date.now()}`,
          rawContent: 'Test content',
          textContent: 'Test content',
          isProcessed: true,
        },
      });
    }

    // Create the byte
    const byte = await prisma.contentByte.create({
      data: {
        editionId: edition.id,
        content,
        type: type || 'insight',
        author: author || null,
        category: category || 'wisdom',
        qualityScore: 0.8,
      },
    });

    res.json({
      message: 'Test byte created',
      byteId: byte.id,
    });
  } catch (error) {
    console.error('Test byte error:', error);
    res.status(500).json({ error: 'Failed to create test byte' });
  }
});

export default router;

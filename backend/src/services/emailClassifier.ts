/**
 * Email Classification Service
 * Determines if an email is a legitimate newsletter or junk/promotional content
 */

// Common patterns for junk/promotional emails
const JUNK_PATTERNS = {
  // Promotional keywords in subject
  subjectPatterns: [
    /\b(sale|discount|off|deal|offer|promo|coupon|free|limited time|act now|urgent|last chance)\b/i,
    /\b(\d+%\s*off|save\s*\$\d+|buy\s*\d+\s*get|flash\s*sale)\b/i,
    /\b(order\s*confirm|shipping\s*confirm|delivery|track\s*your|your\s*order)\b/i,
    /\b(unsubscribe|no\s*longer|opt\s*out|manage\s*preferences)\b/i,
    /\b(verify\s*your|confirm\s*your\s*email|activate\s*your|reset\s*password)\b/i,
  ],

  // Sender domains commonly associated with promotional/transactional emails
  promotionalDomains: [
    'amazonses.com',
    'sendgrid.net',
    'mailchimp.com',
    'constantcontact.com',
    'campaign-archive.com',
    'mailgun.org',
    'postmarkapp.com',
    'shopify.com',
    'squarespace.com',
    'wix.com',
  ],

  // Transactional email patterns
  transactionalPatterns: [
    /\b(receipt|invoice|order\s*#|transaction|payment|refund)\b/i,
    /\b(verify\s*account|confirm\s*email|welcome\s*to|thanks\s*for\s*signing|password\s*reset)\b/i,
    /\b(tracking\s*number|shipped|delivered|delivery\s*update|out\s*for\s*delivery)\b/i,
    /\b(subscription\s*expir|renew|billing|account\s*update)\b/i,
  ],

  // Spam indicators in content
  spamPatterns: [
    /<img[^>]*width=["']?1["']?[^>]*height=["']?1["']?/i, // Tracking pixels
    /click\s*here\s*to\s*unsubscribe/i,
    /view\s*this\s*email\s*in\s*your\s*browser/i,
    /having\s*trouble\s*viewing/i,
    /add\s*us\s*to\s*your\s*address\s*book/i,
  ],
};

// Positive indicators for legitimate newsletters
const NEWSLETTER_PATTERNS = {
  // Subject patterns common in quality newsletters
  subjectPatterns: [
    /\b(weekly|monthly|daily)\s*(digest|roundup|newsletter|update|edition)\b/i,
    /\b(issue\s*#?\d+|edition\s*#?\d+|vol\w*\.?\s*\d+)\b/i,
    /\b(thoughts\s*on|lessons|insights|ideas|reflections)\b/i,
    /\b(how\s*to|why|what\s*i\s*learned|the\s*art\s*of)\b/i,
  ],

  // Known newsletter domains (curated list)
  trustedDomains: [
    'substack.com',
    'beehiiv.com',
    'convertkit.com',
    'buttondown.email',
    'revue.co',
    'ghost.io',
    'jamesclear.com',
    'fs.blog',
    'sahilbloom.com',
    '3-2-1.club',
  ],

  // Content patterns
  contentPatterns: [
    /\b(in\s*this\s*(issue|edition|newsletter))\b/i,
    /\b(today['']?s\s*(edition|thoughts|links))\b/i,
    /\b(happy\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i,
  ],
};

export interface ClassificationResult {
  isNewsletter: boolean;
  isJunk: boolean;
  confidence: number; // 0-1
  reason: string;
  category?: 'newsletter' | 'promotional' | 'transactional' | 'spam' | 'unknown';
}

/**
 * Classify an email as newsletter, junk, or unknown
 */
export function classifyEmail(
  subject: string,
  senderEmail: string,
  senderName: string,
  textContent: string,
  htmlContent: string = ''
): ClassificationResult {
  let score = 0; // Positive = newsletter, Negative = junk
  const reasons: string[] = [];

  const senderDomain = senderEmail.split('@')[1]?.toLowerCase() || '';
  const contentLength = textContent.length;

  // ==========================================================================
  // POSITIVE SIGNALS (Newsletter indicators)
  // ==========================================================================

  // Check if from trusted newsletter platform
  const isTrustedDomain = NEWSLETTER_PATTERNS.trustedDomains.some(
    domain => senderDomain.includes(domain) || senderEmail.includes(domain)
  );
  if (isTrustedDomain) {
    score += 3;
    reasons.push('Trusted newsletter platform');
  }

  // Check subject for newsletter patterns
  const hasNewsletterSubject = NEWSLETTER_PATTERNS.subjectPatterns.some(
    pattern => pattern.test(subject)
  );
  if (hasNewsletterSubject) {
    score += 2;
    reasons.push('Newsletter-style subject');
  }

  // Check content for newsletter patterns
  const hasNewsletterContent = NEWSLETTER_PATTERNS.contentPatterns.some(
    pattern => pattern.test(textContent)
  );
  if (hasNewsletterContent) {
    score += 2;
    reasons.push('Newsletter content patterns');
  }

  // Decent content length (newsletters tend to be longer)
  if (contentLength > 1000) {
    score += 1;
  }
  if (contentLength > 3000) {
    score += 1;
  }

  // ==========================================================================
  // NEGATIVE SIGNALS (Junk/promotional indicators)
  // ==========================================================================

  // Check for promotional subject patterns
  const hasPromotionalSubject = JUNK_PATTERNS.subjectPatterns.some(
    pattern => pattern.test(subject)
  );
  if (hasPromotionalSubject) {
    score -= 2;
    reasons.push('Promotional subject');
  }

  // Check for transactional patterns
  const isTransactional = JUNK_PATTERNS.transactionalPatterns.some(
    pattern => pattern.test(subject) || pattern.test(textContent.slice(0, 500))
  );
  if (isTransactional) {
    score -= 3;
    reasons.push('Transactional email');
  }

  // Check HTML for spam patterns
  if (htmlContent) {
    const hasSpamPatterns = JUNK_PATTERNS.spamPatterns.some(
      pattern => pattern.test(htmlContent)
    );
    if (hasSpamPatterns) {
      score -= 1;
      reasons.push('Contains spam patterns');
    }
  }

  // Very short content is suspicious
  if (contentLength < 200) {
    score -= 2;
    reasons.push('Very short content');
  }

  // Check sender domain
  const isPromoDomaion = JUNK_PATTERNS.promotionalDomains.some(
    domain => senderDomain.includes(domain)
  );
  if (isPromoDomaion && !isTrustedDomain) {
    // Only penalize if not also a trusted domain
    score -= 1;
    reasons.push('Promotional sender domain');
  }

  // ==========================================================================
  // FINAL CLASSIFICATION
  // ==========================================================================

  // Determine category and confidence
  let category: ClassificationResult['category'];
  let confidence: number;

  if (score >= 3) {
    category = 'newsletter';
    confidence = Math.min(0.95, 0.6 + score * 0.1);
  } else if (score <= -3) {
    category = isTransactional ? 'transactional' : 'promotional';
    confidence = Math.min(0.95, 0.6 + Math.abs(score) * 0.1);
  } else if (score < 0) {
    category = 'promotional';
    confidence = 0.5 + Math.abs(score) * 0.1;
  } else {
    category = 'unknown';
    confidence = 0.5;
  }

  // Special case: transactional emails should be rejected regardless of other signals
  if (isTransactional) {
    return {
      isNewsletter: false,
      isJunk: true,
      confidence: 0.85,
      reason: 'Transactional email (orders, receipts, account notifications)',
      category: 'transactional',
    };
  }

  return {
    isNewsletter: score > 0,
    isJunk: score < 0,
    confidence,
    reason: reasons.length > 0 ? reasons.join(', ') : 'No strong indicators',
    category,
  };
}

/**
 * Quick check if email should be processed (lightweight check)
 */
export function shouldProcessEmail(
  subject: string,
  senderEmail: string,
  contentLength: number
): { process: boolean; reason?: string } {
  // Always reject very short emails
  if (contentLength < 100) {
    return { process: false, reason: 'Content too short' };
  }

  // Quick transactional check
  const transactionalKeywords = /\b(order|receipt|invoice|shipping|delivered|tracking|password|verify|confirm\s*email|activate)\b/i;
  if (transactionalKeywords.test(subject)) {
    return { process: false, reason: 'Transactional email' };
  }

  // Check for spam indicators in subject
  const spamSubject = /\b(winner|lottery|casino|pills|viagra|bitcoin\s*giveaway|congratulations\s*you)\b/i;
  if (spamSubject.test(subject)) {
    return { process: false, reason: 'Spam detected' };
  }

  return { process: true };
}

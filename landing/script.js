/**
 * ByteLetters Landing Page - JavaScript
 * Handles: Byte preview, Cookie consent, Privacy modal
 */

// =============================================================================
// Configuration
// =============================================================================

const API_BASE_URL = 'https://byteletters-api.onrender.com'; // Production API
const FALLBACK_API_URL = 'http://localhost:3000'; // Local dev
const COOKIE_CONSENT_KEY = 'byteletters_cookie_consent';

// Fallback bytes in case API is unavailable
const FALLBACK_BYTES = [
  {
    content: "The best time to plant a tree was 20 years ago. The second best time is now.",
    type: "quote",
    author: "Chinese Proverb",
    source: { name: "Ancient Wisdom" },
  },
  {
    content: "You don't rise to the level of your goals; you fall to the level of your systems.",
    type: "insight",
    author: "James Clear",
    source: { name: "Atomic Habits" },
  },
  {
    content: "1% better every day compounds to 37x better in a year. Small improvements, massive results.",
    type: "statistic",
    author: null,
    source: { name: "The Math of Growth" },
  },
  {
    content: "Ask yourself: What would this look like if it were easy? Then do that version first.",
    type: "action",
    author: "Tim Ferriss",
    source: { name: "Tools of Titans" },
  },
  {
    content: "The obstacle is the way. Every problem contains the seed of its own solution.",
    type: "insight",
    author: "Marcus Aurelius",
    source: { name: "Stoic Philosophy" },
  },
  {
    content: "Motion is not progress. Busyness is not productivity. Activity is not achievement.",
    type: "counterintuitive",
    author: null,
    source: { name: "Deep Work Principles" },
  },
  {
    content: "Your inbox is other people's priorities. Guard your attention like your most valuable asset.",
    type: "insight",
    author: null,
    source: { name: "Attention Management" },
  },
  {
    content: "The person who carefully designs their daily routine goes further than the genius who leaves it to chance.",
    type: "quote",
    author: "Naval Ravikant",
    source: { name: "Naval's Wisdom" },
  },
];

// =============================================================================
// State
// =============================================================================

let bytes = [...FALLBACK_BYTES];
let currentByteIndex = 0;
let isLoading = false;

// =============================================================================
// DOM Elements
// =============================================================================

const byteCard = document.getElementById('byte-card');
const byteTypeEl = document.getElementById('byte-type');
const byteSourceEl = document.getElementById('byte-source');
const byteTextEl = document.getElementById('byte-text');
const byteAuthorEl = document.getElementById('byte-author');
const nextByteBtn = document.getElementById('next-byte');
const cookieBanner = document.getElementById('cookie-banner');
const cookieAcceptBtn = document.getElementById('cookie-accept');
const cookieDeclineBtn = document.getElementById('cookie-decline');
const privacyModal = document.getElementById('privacy-modal');
const privacyLink = document.getElementById('privacy-link');
const modalCloseBtn = document.getElementById('modal-close');

// =============================================================================
// Byte Preview Functions
// =============================================================================

/**
 * Fetch bytes from the API
 */
async function fetchBytes() {
  try {
    // Try production API first
    let response = await fetch(`${API_BASE_URL}/test-feed?limit=20`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    // If production fails, try localhost (for development)
    if (!response.ok) {
      response = await fetch(`${FALLBACK_API_URL}/test-feed?limit=20`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
    }

    if (response.ok) {
      const data = await response.json();
      if (data.bytes && data.bytes.length > 0) {
        bytes = data.bytes;
        shuffleArray(bytes);
        console.log(`[ByteLetters] Loaded ${bytes.length} bytes from API`);
      }
    }
  } catch (error) {
    console.log('[ByteLetters] Using fallback bytes:', error.message);
  }
}

/**
 * Shuffle array in place
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * Display a byte in the card
 */
function displayByte(byte) {
  if (!byte) return;

  // Apply loading state
  byteCard.classList.add('loading');

  // Small delay for animation effect
  setTimeout(() => {
    // Update type badge
    byteTypeEl.textContent = byte.type || 'insight';
    byteTypeEl.className = `byte-type ${byte.type || 'insight'}`;

    // Update source
    byteSourceEl.textContent = byte.source?.name || 'ByteLetters';

    // Update content
    byteTextEl.textContent = byte.content;

    // Update author
    if (byte.author) {
      byteAuthorEl.textContent = `— ${byte.author}`;
      byteAuthorEl.style.display = 'block';
    } else {
      byteAuthorEl.style.display = 'none';
    }

    // Remove loading state and add fade-in
    byteCard.classList.remove('loading');
    byteCard.classList.add('fade-in');
    setTimeout(() => byteCard.classList.remove('fade-in'), 300);
  }, 150);
}

/**
 * Show next byte
 */
function showNextByte() {
  if (isLoading) return;

  currentByteIndex = (currentByteIndex + 1) % bytes.length;
  displayByte(bytes[currentByteIndex]);
}

/**
 * Initialize byte preview
 */
async function initBytePreview() {
  // Display first fallback byte immediately
  displayByte(bytes[0]);

  // Then fetch from API in background
  await fetchBytes();

  // Display a random byte from the fetched set
  currentByteIndex = Math.floor(Math.random() * bytes.length);
  displayByte(bytes[currentByteIndex]);
}

// =============================================================================
// Cookie Consent Functions
// =============================================================================

/**
 * Check if user has already responded to cookie consent
 */
function hasConsentResponse() {
  return localStorage.getItem(COOKIE_CONSENT_KEY) !== null;
}

/**
 * Save consent response
 */
function saveConsentResponse(accepted) {
  localStorage.setItem(COOKIE_CONSENT_KEY, accepted ? 'accepted' : 'declined');
}

/**
 * Show cookie banner
 */
function showCookieBanner() {
  cookieBanner.classList.add('visible');
}

/**
 * Hide cookie banner
 */
function hideCookieBanner() {
  cookieBanner.classList.remove('visible');
}

/**
 * Initialize cookie consent
 */
function initCookieConsent() {
  // If user has already responded, don't show banner
  if (hasConsentResponse()) {
    return;
  }

  // Show banner after a short delay
  setTimeout(showCookieBanner, 1500);
}

// =============================================================================
// Privacy Modal Functions
// =============================================================================

/**
 * Show privacy modal
 */
function showPrivacyModal(e) {
  e.preventDefault();
  privacyModal.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

/**
 * Hide privacy modal
 */
function hidePrivacyModal() {
  privacyModal.classList.remove('visible');
  document.body.style.overflow = '';
}

// =============================================================================
// Event Listeners
// =============================================================================

// Next byte button
nextByteBtn.addEventListener('click', showNextByte);

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === ' ') {
    if (document.activeElement === document.body || document.activeElement === nextByteBtn) {
      e.preventDefault();
      showNextByte();
    }
  }
  if (e.key === 'Escape') {
    hidePrivacyModal();
  }
});

// Cookie consent buttons
cookieAcceptBtn.addEventListener('click', () => {
  saveConsentResponse(true);
  hideCookieBanner();
});

cookieDeclineBtn.addEventListener('click', () => {
  saveConsentResponse(false);
  hideCookieBanner();
});

// Privacy modal
privacyLink.addEventListener('click', showPrivacyModal);
modalCloseBtn.addEventListener('click', hidePrivacyModal);
privacyModal.addEventListener('click', (e) => {
  if (e.target === privacyModal) {
    hidePrivacyModal();
  }
});

// =============================================================================
// Initialize
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initBytePreview();
  initCookieConsent();

  // Add smooth scroll behavior for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Animate mortality bar fill on scroll
  const mortalitySection = document.querySelector('.mortality-section');
  const mortalityFill = document.querySelector('.mortality-fill');

  if (mortalitySection && mortalityFill) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          mortalityFill.style.width = '62%';
        }
      });
    }, { threshold: 0.5 });

    observer.observe(mortalitySection);
    // Start with 0 width
    mortalityFill.style.width = '0%';
  }
});

// Auto-rotate bytes every 8 seconds
let autoRotateInterval;

function startAutoRotate() {
  autoRotateInterval = setInterval(() => {
    showNextByte();
  }, 8000);
}

function stopAutoRotate() {
  clearInterval(autoRotateInterval);
}

// Start auto-rotate after page loads
setTimeout(startAutoRotate, 3000);

// Pause auto-rotate when user interacts with the byte card
byteCard.addEventListener('mouseenter', stopAutoRotate);
byteCard.addEventListener('mouseleave', startAutoRotate);

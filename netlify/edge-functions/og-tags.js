/**
 * Netlify Edge Function to serve dynamic OG tags for social media crawlers.
 * For regular users, serves the static page. For crawlers, returns minimal HTML with proper OG tags.
 */
export default async (request, context) => {
  const userAgent = request.headers.get('user-agent') || '';

  // Check if request is from a social media crawler
  const crawlerPattern = /facebookexternalhit|twitterbot|slackbot|linkedinbot|discordbot|telegrambot|whatsapp|pinterest|embedly|quora|outbrain|vkshare|skypeuripreview/i;
  const isCrawler = crawlerPattern.test(userAgent);

  if (!isCrawler) {
    // Serve the static page normally for regular users
    return context.next();
  }

  // Parse URL params for dynamic OG content
  const url = new URL(request.url);
  const params = url.searchParams;

  // Get player names and round info
  const playerAName = params.get('pAN');
  const playerBName = params.get('pBN');
  const round = params.get('round');
  const status = params.get('status');

  // Determine the sender (the player who shared the link)
  // If Player B exists, they're probably the one sharing to A, otherwise A is sharing to invite B
  const senderName = playerBName || playerAName;

  // Build dynamic title
  let title = 'Dinner Quest - A Roguelike for Couples';
  let description = 'A text-based RPG roguelike for couples to decide on dinner for the week. Draft, bid, and resolve your way to the perfect meal plan.';

  if (status === 'complete') {
    title = 'Dinner Quest - Our Meal Plan is Ready!';
    description = 'We completed our Dinner Quest! Check out our meal plan for the week.';
  } else if (senderName && round) {
    title = `${senderName} invites you to Dinner Quest - Round ${round}`;
    description = `Join ${senderName} in Dinner Quest to plan meals together!`;
  } else if (senderName) {
    title = `${senderName} invites you to Dinner Quest`;
    description = `Join ${senderName} in Dinner Quest - a roguelike for couples to decide on dinner!`;
  }

  // Get the origin for absolute URLs
  const origin = url.origin;

  // Return minimal HTML with OG tags for crawlers
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(url.href)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${origin}/share-card.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${escapeHtml(url.href)}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${origin}/share-card.png">
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=3600'
    }
  });
};

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Configure which paths this edge function handles
export const config = {
  path: ['/', '/waiting', '/game', '/complete']
};

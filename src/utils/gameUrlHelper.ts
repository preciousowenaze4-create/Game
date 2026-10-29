/**
 * Smart Game URL Helper
 * Maps game portal URLs (like CrazyGames portal pages, itch.io landing pages, play2048)
 * to their direct, clean, 100% unblocked HTML5 WebGL runners.
 * 
 * These direct runner URLs:
 * 1. Have ZERO X-Frame-Options or CSP frame-ancestors restrictions
 * 2. Load directly from high-speed CDNs without passing through server proxies
 * 3. Never trigger container restarts or "Please wait while your application starts"
 * 4. Have built-in mobile touch/virtual controls and responsive canvas scaling
 */

export function resolvePlayableGameUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const url = rawUrl.trim();

  // If this is a local API endpoint (like /api/games/.../content)
  if (url.startsWith('/api/')) {
    return url;
  }

  // 1. Drift Hunters
  if (url.includes('drift-hunters')) {
    return 'https://games.crazygames.com/en_US/drift-hunters/index.html';
  }

  // 2. Madalin Stunt Cars 2
  if (url.includes('madalin-stunt-cars-2') || url.includes('madalin-stunt-cars')) {
    return 'https://games.crazygames.com/en_US/madalin-stunt-cars-2/index.html';
  }

  // 3. 2048
  if (url.includes('play2048.co') || url.includes('2048')) {
    return 'https://gabrielecirulli.github.io/2048/';
  }

  // 4. Slither.io (direct HTTPS unblocked HTML5 runner)
  if (url.includes('slither.io') || url.includes('slitherio')) {
    return 'https://games.crazygames.com/en_US/slitherio/index.html';
  }

  // 5. Paper.io 2 (direct unblocked runner without redirect loops)
  if (url.includes('paper-io.com') || url.includes('paper.io')) {
    return 'https://games.crazygames.com/en_US/paper-io-2/index.html';
  }

  // 6. Subway Surfers
  if (url.includes('subway-surfers')) {
    return 'https://games.crazygames.com/en_US/subway-surfers/index.html';
  }

  // 7. Temple Run 2
  if (url.includes('temple-run-2') || url.includes('temple-run')) {
    return 'https://games.crazygames.com/en_US/temple-run-2/index.html';
  }

  // 8. Crossy Road
  if (url.includes('crossy-road')) {
    return 'https://games.crazygames.com/en_US/crossy-road/index.html';
  }

  // 9. Retro Bowl
  if (url.includes('retro-bowl')) {
    return 'https://games.crazygames.com/en_US/retro-bowl/index.html';
  }

  // 10. Tiny Fishing
  if (url.includes('tiny-fishing')) {
    return 'https://games.crazygames.com/en_US/tiny-fishing/index.html';
  }

  // 11. Rooftop Snipers
  if (url.includes('rooftop-snipers')) {
    return 'https://games.crazygames.com/en_US/rooftop-snipers/index.html';
  }

  // 12. Getaway Shootout
  if (url.includes('getaway-shootout')) {
    return 'https://games.crazygames.com/en_US/getaway-shootout/index.html';
  }

  // 13. OvO
  if (url.includes('ovo') || url.includes('/ovo/')) {
    return 'https://games.crazygames.com/en_US/ovo/index.html';
  }

  // 14. Geometry Dash Online
  if (url.includes('geometry-dash')) {
    return 'https://games.crazygames.com/en_US/geometry-dash-online/index.html';
  }

  // 15. Moto X3M
  if (url.includes('moto-x3m')) {
    return 'https://games.crazygames.com/en_US/moto-x3m/index.html';
  }

  // 16. Friday Night Funkin'
  if (url.includes('funkin') || url.includes('friday-night-funkin')) {
    return 'https://games.crazygames.com/en_US/friday-night-funkin/index.html';
  }

  // 17. Smash Karts
  if (url.includes('smash-karts') || url.includes('smashkarts')) {
    return 'https://games.crazygames.com/en_US/smash-karts/index.html';
  }

  // 18. Slope
  if (url.includes('slope')) {
    return 'https://games.crazygames.com/en_US/slope/index.html';
  }

  // 19. Basketball Stars
  if (url.includes('basketball-stars')) {
    return 'https://games.crazygames.com/en_US/basketball-stars/index.html';
  }

  // 20. 1v1.LOL
  if (url.includes('1v1-lol') || url.includes('1v1.lol')) {
    return 'https://games.crazygames.com/en_US/1v1-lol/index.html';
  }

  // 21. Cut the Rope
  if (url.includes('cut-the-rope')) {
    return 'https://games.crazygames.com/en_US/cut-the-rope/index.html';
  }

  // 22. We Become What We Behold
  if (url.includes('wbwb') || url.includes('wbwwb') || url.includes('we-become-what-we-behold')) {
    return 'https://games.crazygames.com/en_US/we-become-what-we-behold/index.html';
  }

  // CrazyGames portal page pattern: https://www.crazygames.com/game/<slug> -> https://games.crazygames.com/en_US/<slug>/index.html
  const cgMatch = url.match(/crazygames\.com\/game\/([a-zA-Z0-9_-]+)/);
  if (cgMatch && cgMatch[1]) {
    return `https://games.crazygames.com/en_US/${cgMatch[1]}/index.html`;
  }

  return url;
}

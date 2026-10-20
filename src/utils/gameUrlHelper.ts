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

  // 1. Drift Hunters
  if (url.includes('drift-hunters')) {
    return 'https://games.crazygames.com/en_US/drift-hunters/index.html';
  }

  // 2. Madalin Stunt Cars 2
  if (url.includes('madalin-stunt-cars-2') || url.includes('madalin-stunt-cars')) {
    return 'https://games.crazygames.com/en_US/madalin-stunt-cars-2/index.html';
  }

  // 3. 2048 (play2048.co has frame-ancestors CSP; gabrielecirulli.github.io is the official 100% embeddable mobile version)
  if (url.includes('play2048.co') || url.includes('2048')) {
    return 'https://gabrielecirulli.github.io/2048/';
  }

  // 4. Friday Night Funkin'
  if (url.includes('funkin') || url.includes('friday-night-funkin')) {
    return 'https://games.crazygames.com/en_US/friday-night-funkin/index.html';
  }

  // 5. We Become What We Behold
  if (url.includes('wbwb') || url.includes('wbwwb') || url.includes('we-become-what-we-behold')) {
    return 'https://games.crazygames.com/en_US/we-become-what-we-behold/index.html';
  }

  // 6. Slither.io
  if (url.includes('slither.io')) {
    return 'https://slither.io/';
  }

  // 7. Paper.io 2
  if (url.includes('paper-io.com') || url.includes('paper.io')) {
    return 'https://paper-io.com/';
  }

  // 8. Moto X3M
  if (url.includes('moto-x3m')) {
    return 'https://games.crazygames.com/en_US/moto-x3m/index.html';
  }

  // 9. Smash Karts
  if (url.includes('smash-karts') || url.includes('smashkarts')) {
    return 'https://games.crazygames.com/en_US/smash-karts/index.html';
  }

  // 10. Slope 3D
  if (url.includes('slope')) {
    return 'https://slope-game.github.io/';
  }

  // 11. Basketball Stars
  if (url.includes('basketball-stars')) {
    return 'https://games.crazygames.com/en_US/basketball-stars/index.html';
  }

  // 12. CrazyGames portal pattern: https://www.crazygames.com/game/<slug> -> https://games.crazygames.com/en_US/<slug>/index.html
  const cgMatch = url.match(/crazygames\.com\/game\/([a-zA-Z0-9_-]+)/);
  if (cgMatch && cgMatch[1]) {
    return `https://games.crazygames.com/en_US/${cgMatch[1]}/index.html`;
  }

  // If already a direct games.crazygames.com, github.io, or direct domain
  return url;
}

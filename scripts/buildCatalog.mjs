import fs from 'fs';

async function buildCatalog() {
  const tags = [
    'car', 'driving', 'action', 'arcade', 'multiplayer', 'puzzle', 
    'sports', 'bike', 'shooting', 'drift', 'casual', 
    'adventure', 'clicker', 'strategy'
  ];
  const allGames = [];
  const seenSlugs = new Set();

  // 1. Primary requested games with verified direct runners and real logos:
  const primaryGames = [
    {
      id: 'drift-hunters',
      title: 'Drift Hunters',
      slug: 'drift-hunters',
      category: 'Car & Driving',
      genre: 'Drifting',
      cover: 'games/drift-hunters/cover-1656950639575.png',
      gameUrl: 'https://games.crazygames.com/en_US/drift-hunters/index.html',
      totalPlays: 48920000,
      rating: 4.9,
      description: '3D drift simulator with 26 customizable cars, 10 detailed race circuits, and realistic vehicle physics.'
    },
    {
      id: 'madalin-stunt-cars-2',
      title: 'Madalin Stunt Cars 2',
      slug: 'madalin-stunt-cars-2',
      category: 'Car & Driving',
      genre: 'Stunt Racing',
      cover: 'games/madalin-stunt-cars-2/cover_16x9-1695113654654.png',
      gameUrl: 'https://games.crazygames.com/en_US/madalin-stunt-cars-2/index.html',
      totalPlays: 35140000,
      rating: 4.8,
      description: 'High-speed 3D stunt car simulator with sky-high loops, corkscrews, obstacle courses, and supercars.'
    },
    {
      id: 'slither-io',
      title: 'Slither.io',
      slug: 'slither-io',
      category: 'Multiplayer .io',
      genre: 'Multiplayer',
      cover: 'slitherio.png',
      gameUrl: 'https://slither.io/',
      totalPlays: 78200000,
      rating: 4.8,
      description: 'The legendary multiplayer snake arena. Slither through glowing orbs, grow massive, and defeat rivals.'
    },
    {
      id: 'paper-io-2',
      title: 'Paper.io 2',
      slug: 'paper-io-2',
      category: 'Multiplayer .io',
      genre: 'Strategy',
      cover: 'paper-io-2_16x9/20250214024143/paper-io-2_16x9-cover',
      gameUrl: 'https://paper-io.com/',
      totalPlays: 52400000,
      rating: 4.7,
      description: 'Capture territory by drawing loops on the arena floor while cutting other players off.'
    },
    {
      id: '2048',
      title: '2048',
      slug: '2048',
      category: 'Mind & Puzzles',
      genre: 'Puzzle',
      cover: 'games/2048/cover_16x9-1707828856995.png',
      gameUrl: 'https://gabrielecirulli.github.io/2048/',
      totalPlays: 63100000,
      rating: 4.9,
      description: 'The classic addictive numerical puzzle. Slide numbered tiles to combine them and reach the 2048 tile.'
    },
    {
      id: 'friday-night-funkin',
      title: "Friday Night Funkin'",
      slug: 'friday-night-funkin',
      category: 'Rhythm & Music',
      genre: 'Rhythm',
      cover: 'games/friday-night-funkin/cover-1614085803807.png',
      gameUrl: 'https://games.crazygames.com/en_US/friday-night-funkin/index.html',
      totalPlays: 41200000,
      rating: 4.9,
      description: 'Fast-paced rhythm battle game with arrow-matching freestyle rap battles against iconic characters.'
    },
    {
      id: 'we-become-what-we-behold',
      title: 'We Become What We Behold',
      slug: 'we-become-what-we-behold',
      category: 'Arcade Classics',
      genre: 'Indie',
      cover: 'webecomewhatwebeholdb.png',
      gameUrl: 'https://games.crazygames.com/en_US/we-become-what-we-behold/index.html',
      totalPlays: 29800000,
      rating: 4.9,
      description: 'Provocative 5-minute interactive experience by Nicky Case about viral media cycles and social behavior.'
    }
  ];

  for (const g of primaryGames) {
    seenSlugs.add(g.slug);
    allGames.push(g);
  }

  // 2. Fetch all games from CrazyGames tags:
  for (const tag of tags) {
    try {
      const res = await fetch(`https://www.crazygames.com/t/${tag}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      if (res.ok) {
        const html = await res.text();
        const scriptMatch = html.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
        if (scriptMatch) {
          const data = JSON.parse(scriptMatch[1]);
          const pp = data.props.pageProps;
          const items = pp.games?.items || [];
          for (const item of items) {
            if (item.slug && !seenSlugs.has(item.slug)) {
              seenSlugs.add(item.slug);
              allGames.push({
                id: item.slug,
                title: item.name,
                slug: item.slug,
                category: item.categoryName || (tag.charAt(0).toUpperCase() + tag.slice(1)),
                genre: tag.charAt(0).toUpperCase() + tag.slice(1),
                cover: item.cover,
                gameUrl: `https://games.crazygames.com/en_US/${item.slug}/index.html`,
                totalPlays: item.totalPlays || 1500000,
                rating: item.totalLikes ? Number(((item.totalLikes / (item.totalLikes + 1000)) * 5).toFixed(1)) : 4.8,
                description: `${item.name} - Play free online HTML5 game with native controls and instant in-app play.`
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('fetch error for tag', tag, e.message);
    }
  }

  // Map cover string to real full URL
  const enrichedGames = allGames.map(g => {
    let thumbnailUrl = '';
    if (g.cover.startsWith('http')) {
      thumbnailUrl = g.cover;
    } else {
      thumbnailUrl = `https://images.crazygames.com/${g.cover}?auto=format,compress&q=75&cs=strip&ch=DPR&w=512`;
    }
    return {
      ...g,
      thumbnailUrl
    };
  });

  console.log(`Successfully built catalog with ${enrichedGames.length} real games!`);
  fs.writeFileSync('src/utils/realCrazyGamesCatalog.json', JSON.stringify(enrichedGames, null, 2));
}

buildCatalog().catch(err => {
  console.error('Build catalog error:', err);
  process.exit(1);
});

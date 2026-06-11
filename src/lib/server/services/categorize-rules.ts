/**
 * Pure keyword-matching rules for event categorization.
 * No imports — safe to use from standalone scripts (npx tsx) as well as
 * the SvelteKit server code in categorize.ts.
 */

// Keyword rules: checked in order, first match wins
export const CATEGORY_RULES: { slug: string; keywords: RegExp }[] = [
  // Fundraiser — benefit events, give-back nights, charity
  {
    slug: 'fundraiser',
    keywords: /\b(fundrais|benefit\b|give[\s-]*back|spirit\s*night|percentage\s*night|community\s*night|dine\s*out\s*(?:for|night)|charity|relay\s*for\s*life|cancer\s*walk|als\s*awareness|pancake\s*breakfast|spaghetti\s*dinner|flapjack)\b/i,
  },
  // Killer Pick — estate sales, rummage, yard sales, thrift, antiques
  {
    slug: 'killer-pick',
    keywords: /\b(estate\s*sale|rummage|yard\s*sale|garage\s*sale|barn\s*sale|flea\s*market|swap\s*meet|thrift|antique|vintage\s*(sale|fair|show)|junk|tag\s*sale|moving\s*sale|downsizing|consignment)\b/i,
  },
  // Live Music
  {
    slug: 'live-music',
    keywords: /\b(live\s*music|concert|band|open\s*mic|karaoke|jazz|blues|acoustic|dj\s|symphony|orchestra|choir|recital|jam\s*session|songwriter|punk|hip[\s-]*hop|reggae|bluegrass|mariachi|tribute\s*(band|show|night))\b/i,
  },
  // Nightlife — specific phrases only; bare "night"/"bar"/"club" caused
  // false positives ("Bible Study Wednesday Night", "Book Club")
  {
    slug: 'nightlife',
    keywords: /\b(nightlife|night\s*club|nightclub|ladies\s*night|guys\s*night|night\s*out|lounge|salsa\s*(social|night|party)|latin\s*night|trivia|bingo|comedy|stand[\s-]*up|roast\s*(session|battle|night)|drag\s*(show|queen|bingo|brunch)|burlesque|after[\s-]*dark|pub\s*crawl|tap\s*room)\b/i,
  },
  // Sports & Fitness
  {
    slug: 'sports-fitness',
    keywords: /\b(yoga|fitness|workout|run\b|run\s*club|marathon|5k|10k|basketball|hoops|baseball|pippin\w*|soccer|football|softball|volleyball|tennis|pickleball|golf|hockey|boxing|mma|wrestling|martial\s*arts|karate|jiu[\s-]*jitsu|taekwondo|cycling|swim|skate|skating|climbing|triathlon|crossfit|pilates|barre\b|tai\s*chi|qi\s*gong|qigong|zumba|bootcamp|athletic|gym|hike|hiking)\b/i,
  },
  // Food & Drink
  {
    slug: 'food-drink',
    keywords: /\b(food|dinner|lunch|brunch|breakfast|bbq|barbecue|tasting|wine|beer|brewery|brew\b|distillery|cocktail|happy\s*hour|cook|chef|restaurant|cafe|coffee|pizza|taco|burger|fish\s*fry|potluck|feast|ribeye|coney)\b/i,
  },
  // Markets & Sales
  {
    slug: 'markets-sales',
    keywords: /\b(market|bazaar|craft\s*(fair|show|sale)|vendor|pop[\s-]*up|artisan|handmade|farmers?\s*market|holiday\s*sale|bake\s*sale|plant\s*sale|book\s*sale)\b/i,
  },
  // Family & Kids
  {
    slug: 'family-kids',
    keywords: /\b(kids|children|family|toddler|baby|storytime|story\s*time|youth|teen|easter\s*egg|egg\s*hunt|trick[\s-]or[\s-]treat|santa|bunny|playground|puppet|face\s*paint)\b/i,
  },
  // Arts & Culture
  {
    slug: 'arts-culture',
    keywords: /\b(art|gallery|exhibit|museum|theater|theatre|play\b|musical|dance|ballet|opera|poetry|reading|author|book\s*club|paint|watercolor|sculpture|film|cinema|movie|photography|craft|ceramic|pottery|clay|jewelry|mosaic|quilt|knit|sew)\b/i,
  },
  // Education
  {
    slug: 'education',
    keywords: /\b(class|workshop|seminar|lecture|training|course|learn|education|school|college|university|library|tutor|certification|webinar|conference|summit|panel|presentation|cpr|first\s*aid)\b/i,
  },
  // Outdoors
  {
    slug: 'outdoors',
    keywords: /\b(outdoor|nature|park|trail|camping|fishing|kayak|canoe|river|mountain|garden|birding|wildlife|stargazing|astronomy|cleanup|conservation)\b/i,
  },
  // Community
  {
    slug: 'community',
    keywords: /\b(community|volunteer|fundrais|charity|benefit|auction|gala|ribbon\s*cutting|town\s*hall|city\s*council|meeting|church|worship|bible|service|memorial|veteran|rotary|kiwanis|lions\s*club|chamber|nonprofit|donation|drive\b)\b/i,
  },
  // Holiday
  {
    slug: 'holiday',
    keywords: /\b(christmas|easter|thanksgiving|halloween|valentine|new\s*year|4th\s*of\s*july|fourth\s*of\s*july|independence\s*day|memorial\s*day|labor\s*day|mother'?s?\s*day|father'?s?\s*day|st\.?\s*patrick|mardi\s*gras|cinco\s*de\s*mayo|holiday|good\s*friday|maundy|palm\s*sunday|lent)\b/i,
  },
];

/**
 * Categorize a single event by keywords.
 * Tiered matching: title alone is the strongest signal, then title+location,
 * then a description snippet — so a generic word in the description can't
 * override a clear title match.
 * Returns the category slug or 'other' as fallback.
 */
export function matchCategory(title: string, location?: string, description?: string): string {
  const tiers = [
    title,
    location ? `${title} ${location}` : '',
    description ? `${title} ${location || ''} ${description.slice(0, 300)}` : '',
  ];

  for (const text of tiers) {
    if (!text) continue;
    for (const rule of CATEGORY_RULES) {
      if (rule.keywords.test(text)) {
        return rule.slug;
      }
    }
  }

  return 'other';
}

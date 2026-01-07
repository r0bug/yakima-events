/**
 * LLM Service
 * Segmind API integration for intelligent event scraping
 */

import { SEGMIND_API_KEY } from '$env/static/private';

const SEGMIND_BASE_URL = 'https://api.segmind.com/v1/';

// Model endpoints - Kimi K2 as primary (Claude-like capabilities)
const MODEL_KIMI_K2 = 'kimi-k2-instruct-0905';

interface LLMResponse {
  content?: Array<{ text: string }>;
  choices?: Array<{ message: { content: string } }>;
  generated_text?: string;
  text?: string;
  output?: string;
  response?: string;
}

export interface EventAnalysis {
  hasEvents: boolean;
  eventType: 'list' | 'calendar' | 'links' | 'news' | 'schedule' | 'none';
  eventsFound: Array<{
    title: string;
    date?: string;
    time?: string;
    location?: string;
    description?: string;
    link?: string;
  }>;
  eventLinks?: string[];
  selectors?: {
    eventContainer?: string;
    title?: string;
    date?: string;
    location?: string;
    description?: string;
    link?: string;
  };
  patterns?: {
    dateFormat?: string;
    urlPattern?: string;
  };
}

export interface ExtractionMethod {
  domain: string;
  urlPattern: string;
  type: string;
  selectors?: Record<string, string>;
  patterns?: Record<string, string>;
  confidence: number;
}

/**
 * Make request to Segmind API
 */
async function makeRequest(endpoint: string, data: Record<string, unknown>): Promise<LLMResponse> {
  if (!SEGMIND_API_KEY) {
    throw new Error('Segmind API key not configured');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': SEGMIND_API_KEY,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[LLM] API error: HTTP ${response.status}`, errorText.substring(0, 200));
    throw new Error(`LLM API error: HTTP ${response.status}`);
  }

  const result = await response.json();
  return result as LLMResponse;
}

/**
 * Extract text content from LLM response
 */
function extractContent(response: LLMResponse): string | null {
  // Handle various response formats
  if (response.content?.[0]?.text) {
    return response.content[0].text;
  }
  if (response.choices?.[0]?.message?.content) {
    return response.choices[0].message.content;
  }
  if (response.generated_text) {
    return response.generated_text;
  }
  if (response.text) {
    return response.text;
  }
  if (response.output) {
    return response.output;
  }
  if (response.response) {
    return response.response;
  }

  console.warn('[LLM] Unknown response format:', Object.keys(response));
  return null;
}

/**
 * Parse JSON from LLM response
 */
function parseJSONResponse<T>(response: LLMResponse): T | null {
  const content = extractContent(response);
  if (!content) {
    return null;
  }

  let jsonStr = content;

  // Extract JSON from markdown code blocks
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1];
  }

  // Try to find JSON object or array
  const jsonMatch = jsonStr.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  try {
    return JSON.parse(jsonStr) as T;
  } catch (e) {
    // Try cleaning up common issues
    jsonStr = jsonStr.replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ');
    try {
      return JSON.parse(jsonStr) as T;
    } catch (e2) {
      console.error('[LLM] JSON parse error:', e2);
      return null;
    }
  }
}

/**
 * Analyze HTML content to find event patterns
 */
export async function findEventPatterns(
  htmlContent: string,
  url: string
): Promise<EventAnalysis | null> {
  const endpoint = SEGMIND_BASE_URL + MODEL_KIMI_K2;

  const prompt = `Analyze this webpage to find events or event information. Be very thorough and look for ANY type of event content.

URL: ${url}

Look for:
1. Event listings with dates, times, titles (any format)
2. Calendar views or event calendars
3. News about upcoming events
4. Meeting schedules, performances, workshops
5. Festival announcements, community gatherings
6. Business hours that mention special events
7. "Upcoming", "Events", "Calendar", "What's On" sections
8. Event-related data in JSON-LD, microdata, or structured formats
9. Links to event detail pages or external calendars
10. Even minimal event mentions like "Next meeting: June 15"

IMPORTANT: If you find ANY event-related content, set has_events to true. Extract whatever event information is available, even if incomplete.

For each event found, include:
- title (even if generic like "Meeting")
- date/time (any format found)
- location (if mentioned)
- description (any details available)
- link (if clickable)

Return a JSON response with:
{
    "has_events": true/false,
    "event_type": "list"|"calendar"|"links"|"news"|"schedule"|"none",
    "events_found": [
        {
            "title": "...",
            "date": "...",
            "time": "...",
            "location": "...",
            "description": "...",
            "link": "..."
        }
    ],
    "event_links": [...],
    "selectors": {
        "event_container": "...",
        "title": "...",
        "date": "...",
        "location": "...",
        "link": "..."
    },
    "patterns": {
        "date_format": "...",
        "url_pattern": "..."
    }
}

HTML Content:
${htmlContent.substring(0, 30000)}`;

  const data = {
    instruction: 'You are an expert at finding event information in HTML. Always return valid JSON.',
    temperature: 0.3,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  try {
    const response = await makeRequest(endpoint, data);
    const result = parseJSONResponse<{
      has_events?: boolean;
      hasEvents?: boolean;
      event_type?: string;
      eventType?: string;
      events_found?: EventAnalysis['eventsFound'];
      eventsFound?: EventAnalysis['eventsFound'];
      event_links?: string[];
      eventLinks?: string[];
      selectors?: EventAnalysis['selectors'];
      patterns?: EventAnalysis['patterns'];
    }>(response);

    if (!result) {
      return null;
    }

    // Normalize field names (handle both snake_case and camelCase)
    return {
      hasEvents: result.has_events ?? result.hasEvents ?? false,
      eventType: (result.event_type ?? result.eventType ?? 'none') as EventAnalysis['eventType'],
      eventsFound: result.events_found ?? result.eventsFound ?? [],
      eventLinks: result.event_links ?? result.eventLinks ?? [],
      selectors: result.selectors,
      patterns: result.patterns,
    };
  } catch (error) {
    console.error('[LLM] findEventPatterns error:', error);
    return null;
  }
}

/**
 * Generate reusable extraction method from found events
 */
export async function generateExtractionMethod(
  htmlContent: string,
  foundEvents: EventAnalysis['eventsFound'],
  url: string
): Promise<ExtractionMethod | null> {
  const endpoint = SEGMIND_BASE_URL + MODEL_KIMI_K2;

  const prompt = `Based on the following HTML content and successfully extracted events, generate a reusable extraction method.

URL: ${url}
Found Events: ${JSON.stringify(foundEvents, null, 2)}

Create a JSON extraction method with:
1. CSS selectors or XPath expressions to find events
2. Field mappings (title, date, location, description, etc.)
3. Date parsing patterns
4. URL construction rules if events link to detail pages
5. Any special processing rules

Return ONLY valid JSON with the extraction method:
{
    "domain": "example.com",
    "url_pattern": "https://example.com/events/*",
    "type": "list",
    "selectors": {
        "event_container": ".event-item",
        "title": ".event-title",
        "date": ".event-date",
        "location": ".event-location",
        "link": "a.event-link"
    },
    "patterns": {
        "date_format": "MMMM D, YYYY",
        "url_base": "https://example.com"
    },
    "confidence": 0.8
}

HTML Sample:
${htmlContent.substring(0, 20000)}`;

  const data = {
    instruction: 'You are an expert at creating reusable web scraping methods. Always return valid JSON.',
    temperature: 0.2,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  try {
    const response = await makeRequest(endpoint, data);
    const result = parseJSONResponse<{
      domain?: string;
      url_pattern?: string;
      urlPattern?: string;
      type?: string;
      selectors?: Record<string, string>;
      patterns?: Record<string, string>;
      confidence?: number;
    }>(response);

    if (!result) {
      return null;
    }

    // Parse domain from URL if not provided
    const parsedUrl = new URL(url);

    return {
      domain: result.domain || parsedUrl.hostname,
      urlPattern: result.url_pattern || result.urlPattern || generateUrlPattern(url),
      type: result.type || 'list',
      selectors: result.selectors,
      patterns: result.patterns,
      confidence: result.confidence || 0.8,
    };
  } catch (error) {
    console.error('[LLM] generateExtractionMethod error:', error);
    return null;
  }
}

/**
 * Analyze individual event page for details
 */
export async function analyzeEventPage(
  htmlContent: string,
  url: string
): Promise<EventAnalysis['eventsFound'][0] | null> {
  const endpoint = SEGMIND_BASE_URL + MODEL_KIMI_K2;

  const prompt = `Extract event details from this event page. Return JSON with: title, date, start_time, end_time, location, address, description, contact_info, ticket_url

URL: ${url}

HTML Content:
${htmlContent.substring(0, 25000)}`;

  const data = {
    instruction: 'You are an expert at extracting event information. Return valid JSON with event details.',
    temperature: 0.3,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  try {
    const response = await makeRequest(endpoint, data);
    return parseJSONResponse<EventAnalysis['eventsFound'][0]>(response);
  } catch (error) {
    console.error('[LLM] analyzeEventPage error:', error);
    return null;
  }
}

/**
 * Generate URL pattern from example URL
 */
function generateUrlPattern(url: string): string {
  try {
    const parsed = new URL(url);
    let pattern = `${parsed.protocol}//${parsed.hostname}`;

    if (parsed.pathname) {
      // Replace numbers with wildcards
      const path = parsed.pathname.replace(/\d+/g, '*');
      pattern += path;
    }

    return pattern;
  } catch {
    return url;
  }
}

/**
 * Check if LLM service is available
 */
export function isAvailable(): boolean {
  return !!SEGMIND_API_KEY;
}

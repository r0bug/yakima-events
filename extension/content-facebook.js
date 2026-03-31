// YFEvents - Facebook Events Page Content Script
// Extracts events from the visible Facebook events page

(function() {
  'use strict';

  // Avoid double-injection
  if (window.__yfevents_fb_loaded) return;
  window.__yfevents_fb_loaded = true;

  var API_URL = null;
  var API_KEY = null;

  // Load config
  chrome.storage.local.get(['apiUrl', 'apiKey'], function(data) {
    API_URL = data.apiUrl || 'https://yfevents.yakimafinds.com';
    API_KEY = data.apiKey || '';
  });

  // ===== DATE PARSING =====
  var MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
  var DAYS = ['sun','mon','tue','wed','thu','fri','sat'];

  function parseRelativeDate(text) {
    var now = new Date();
    var lower = text.toLowerCase().trim();

    if (lower.indexOf('tomorrow') === 0) {
      var d = new Date(now);
      d.setDate(d.getDate() + 1);
      return extractTimeAndDate(d, text);
    }
    if (lower.indexOf('today') === 0) {
      return extractTimeAndDate(new Date(now), text);
    }
    // "This Saturday at 11 AM"
    var thisDayMatch = lower.match(/this\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+(\d{1,2}(?::\d{2})?)\s*(am|pm)/i);
    if (thisDayMatch) {
      var targetDay = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(thisDayMatch[1].toLowerCase());
      var d = new Date(now);
      var diff = (targetDay - d.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      d.setDate(d.getDate() + diff);
      return applyTime(d, thisDayMatch[2], thisDayMatch[3]);
    }
    return null;
  }

  function extractTimeAndDate(d, text) {
    var timeMatch = text.match(/at\s+(\d{1,2}(?::\d{2})?)\s*(am|pm)/i);
    if (timeMatch) {
      return applyTime(d, timeMatch[1], timeMatch[2]);
    }
    return d.toISOString().split('T')[0];
  }

  function applyTime(d, timeStr, ampm) {
    var parts = timeStr.split(':');
    var hours = parseInt(parts[0]);
    var mins = parts.length > 1 ? parseInt(parts[1]) : 0;
    if (ampm.toLowerCase() === 'pm' && hours < 12) hours += 12;
    if (ampm.toLowerCase() === 'am' && hours === 12) hours = 0;
    d.setHours(hours, mins, 0, 0);
    return d.toISOString();
  }

  function parseAbsoluteDate(text) {
    // "Fri, Jul 10 - Jul 12" or "Sat, May 30 at 5 PM" or "Thu, Sep 3 - Sep 7"
    var match = text.match(/(?:mon|tue|wed|thu|fri|sat|sun)\w*,?\s+(\w+)\s+(\d{1,2})(?:\s*[-–]\s*(?:\w+\s+)?(\d{1,2}))?(?:,?\s+(\d{4}))?(?:\s+at\s+(\d{1,2}(?::\d{2})?)\s*(am|pm))?/i);
    if (!match) return null;

    var monthStr = match[1].toLowerCase().substring(0, 3);
    var month = MONTHS[monthStr];
    if (month === undefined) return null;

    var day = parseInt(match[2]);
    var year = match[4] ? parseInt(match[4]) : new Date().getFullYear();

    // If the date appears to be in the past for this year, bump to next year
    var d = new Date(year, month, day);
    if (!match[4] && d < new Date()) {
      d.setFullYear(d.getFullYear() + 1);
    }

    if (match[5]) {
      return applyTime(d, match[5], match[6]);
    }
    return d.toISOString().split('T')[0];

  }

  function parseDateText(text) {
    return parseRelativeDate(text) || parseAbsoluteDate(text) || text;
  }

  // ===== EVENT EXTRACTION =====
  function extractEvents() {
    var events = [];
    var seenIds = {};

    // Strategy 1: Parse event links with Facebook event IDs
    // These links contain concatenated text: "DateTitleLocationActions"
    var links = document.querySelectorAll('a[href*="/events/"]');
    links.forEach(function(link) {
      var href = link.href;

      // Extract Facebook event ID (numeric)
      var idMatch = href.match(/\/events\/(\d{10,})/);
      if (!idMatch) return;
      var fbId = idMatch[1];

      // Skip if already seen or if it's a nav link
      if (seenIds[fbId]) return;
      if (href.indexOf('calendar') >= 0 || href.indexOf('create') >= 0 ||
          href.indexOf('notifications') >= 0 || href.indexOf('birthdays') >= 0) return;

      var fullText = link.textContent.trim();
      if (fullText.length < 10) return;

      // The link text is usually: "Date Range/TimeEvent TitleLocation TextActions"
      // We need to split it intelligently

      // First, check if this is a clean title-only link (short, no date)
      var hasDate = /(?:mon|tue|wed|thu|fri|sat|sun|today|tomorrow|this\s+\w+day|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(fullText);

      if (!hasDate && fullText.length < 150) {
        // This is likely a clean title link — look for a sibling/parent with full info
        if (!seenIds[fbId]) {
          seenIds[fbId] = { title: fullText, fbId: fbId, url: href.split('?')[0] };
        }
        return;
      }

      if (hasDate && !seenIds[fbId]) {
        seenIds[fbId] = { fullText: fullText, fbId: fbId, url: href.split('?')[0] };
      }
    });

    // Strategy 2: Also look for date spans near the cards
    var dateSpans = document.querySelectorAll('span');
    var dateElements = [];
    dateSpans.forEach(function(span) {
      var text = span.textContent.trim();
      if (text.length > 5 && text.length < 60) {
        var isDate = /^(?:(?:mon|tue|wed|thu|fri|sat|sun)\w*,?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d|today|tomorrow|this\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))/i.test(text);
        if (isDate) {
          dateElements.push({ el: span, text: text });
        }
      }
    });

    // Now assemble events from what we found
    Object.keys(seenIds).forEach(function(fbId) {
      var info = seenIds[fbId];
      var event = {
        source: 'facebook',
        sourceId: 'fb-' + fbId,
        facebookId: fbId,
        url: 'https://www.facebook.com/events/' + fbId + '/',
        title: null,
        startDate: null,
        endDate: null,
        location: null,
        description: null,
        image: null
      };

      if (info.title && !info.fullText) {
        // Clean title link — we have just the title
        event.title = info.title;

        // Try to find date from nearby date spans
        // Look for a card container that holds both this link and a date
        var linkEl = document.querySelector('a[href*="' + fbId + '"]');
        if (linkEl) {
          var card = linkEl.closest('div[class*="x1xmf6yo"], div[class*="xdj266r"]') || linkEl.parentElement.parentElement.parentElement;
          if (card) {
            // Look for date text in the card
            var spans = card.querySelectorAll('span');
            for (var i = 0; i < spans.length; i++) {
              var st = spans[i].textContent.trim();
              if (/^(?:(?:mon|tue|wed|thu|fri|sat|sun)\w*,?\s+|today|tomorrow|this\s+)/i.test(st) && st.length < 60) {
                event.startDate = parseDateText(st);
                event._rawDate = st;
                break;
              }
            }
            // Look for location (address-like text)
            for (var i = 0; i < spans.length; i++) {
              var st = spans[i].textContent.trim();
              if (/\b(?:st|ave|blvd|rd|dr|ln|way|hwy|street|avenue|road|drive)\b/i.test(st) ||
                  /\b(?:WA|OR|CA|ID)\s+\d{5}\b/.test(st) ||
                  /\b(?:Yakima|Selah|Union Gap|Wapato|Ellensburg|Sunnyside)\b/i.test(st)) {
                if (st !== event.title && st.length > 10) {
                  event.location = st;
                  break;
                }
              }
            }
            // Look for venue name (span right after title, not a date or address)
            var foundTitle = false;
            for (var i = 0; i < spans.length; i++) {
              var st = spans[i].textContent.trim();
              if (st === event.title) { foundTitle = true; continue; }
              if (foundTitle && st.length > 3 && st.length < 80 &&
                  !/^(?:Interested|Going|Share|Invite)$/i.test(st) &&
                  !event.location) {
                // Could be venue name
                if (!/^(?:mon|tue|wed|thu|fri|sat|sun|today|tomorrow|this)/i.test(st) &&
                    !/\d{5}/.test(st)) {
                  event.venue = st;
                  break;
                }
              }
            }
            // Look for image
            var img = card.querySelector('img[src*="scontent"], img[src*="fbcdn"]');
            if (img) event.image = img.src;
          }
        }
      } else if (info.fullText) {
        // Concatenated text — parse it
        var text = info.fullText;

        // Try to split: date portion ends before the title
        // Dates look like "Fri, Jul 10 - Jul 12" or "Tomorrow at 8 PM" or "This Saturday at 11 AM"
        var dateEnd = 0;
        var dateMatch = text.match(/^((?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*,?\s+\w+\s+\d{1,2}(?:\s*[-–]\s*(?:\w+\s+)?\d{1,2})?(?:,?\s+\d{4})?(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM))?)|(?:Tomorrow\s+at\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM))|(?:Today\s+at\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM))|(?:This\s+\w+day\s+at\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM)))/i);

        if (dateMatch) {
          event._rawDate = dateMatch[1];
          event.startDate = parseDateText(dateMatch[1]);
          var rest = text.substring(dateMatch[0].length);

          // Rest is: TitleLocationActionsOtherStuff
          // Title usually ends before an address or "Interested"/"Share"
          // Also clean social text from the rest before splitting
          rest = cleanSocialText(rest);
          var actionSplit = rest.match(/^(.*?)(?:Interested|Going|Share|More$)/);
          var meaningful = actionSplit ? actionSplit[1] : rest;

          // Try to split title from location
          // Location often contains street address patterns or known city names
          var locSplit = meaningful.match(/^(.+?)(\d+\s+(?:N\.?|S\.?|E\.?|W\.?)?\s*(?:\w+\s+){1,3}(?:St|Ave|Blvd|Rd|Dr|Ln|Way|Hwy|Road|Street|Avenue|Drive)[\s\S]*)/i);
          if (locSplit) {
            event.title = locSplit[1].trim();
            event.location = locSplit[2].replace(/(?:Interested|Going|Share|More).*$/, '').trim();
          } else {
            // Check for known venue/city patterns
            var venueSplit = meaningful.match(/^(.+?)((?:Yakima|Selah|Union Gap|Wapato|Ellensburg|The |At )[\s\S]*)/i);
            if (venueSplit && venueSplit[1].length > 3) {
              event.title = venueSplit[1].trim();
              event.location = venueSplit[2].replace(/(?:Interested|Going|Share|More).*$/, '').trim();
            } else {
              event.title = meaningful.replace(/(?:Interested|Going|Share|More).*$/, '').trim();
            }
          }
        } else {
          event.title = text.substring(0, 100);
        }

        // Find image from nearby elements
        var linkEl = document.querySelector('a[href*="' + fbId + '"]');
        if (linkEl) {
          var card = linkEl.closest('div') && linkEl.closest('div').parentElement;
          if (card) {
            var img = card.querySelector('img[src*="scontent"], img[src*="fbcdn"]');
            if (img) event.image = img.src;
          }
        }
      }

      // Clean social context junk from all fields before adding
      if (event.title) event.title = cleanSocialText(event.title);
      if (event.location) event.location = cleanSocialText(event.location);
      if (event.venue) event.venue = cleanSocialText(event.venue);

      // Only add if we got a title
      if (event.title && event.title.length > 3) {
        events.push(event);
      }
    });

    return events;
  }

  /**
   * Remove Facebook social engagement text that gets concatenated to event data.
   * e.g. "Yakima, WABreaunna is interested" -> "Yakima, WA"
   */
  function cleanSocialText(text) {
    if (!text) return text;
    // IMPORTANT: Do NOT use /i flag on patterns with [A-Z][a-z]+ (proper name match)
    // because /i makes [a-z] match uppercase, turning "Name" into "any word"

    // "12 interested · 3 going", "1 going", "2 interested" (safe to use /i)
    text = text.replace(/\d+\s+interested(?:\s*·\s*\d+\s+going)?.*$/i, '').trim();
    text = text.replace(/\d+\s+going.*$/i, '').trim();
    // Names glued without space first: "WAErik" or "YakimaTraci, Connor and 5 friends"
    text = text.replace(/([a-z.,])([A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*(?:\s+and\s+(?:[A-Z][a-z]+|\d+\s+friends?))?(?:\s+(?:is|are)\s+(?:interested|going))?\s*$)/, '$1').trim();
    // "Name(s) and Name is/are interested/going" (NO /i flag)
    text = text.replace(/[A-Z][a-z]+(?:(?:,\s*[A-Z][a-z]+)*\s+and\s+(?:[A-Z][a-z]+|\d+\s+friends?))\s+(?:is|are)\s+(?:interested|going).*$/, '').trim();
    text = text.replace(/[A-Z][a-z]+\s+(?:is|are)\s+(?:interested|going).*$/, '').trim();
    text = text.replace(/[A-Z][a-z]+\s+and\s+[A-Z][a-z]+\s+(?:is|are)\s+(?:interested|going).*$/, '').trim();
    // "Name, Name and N friends [interested]" (with or without action word)
    text = text.replace(/[A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*\s+and\s+\d+\s+friends?(?:\s+interested)?.*$/, '').trim();
    // Clean trailing commas/spaces
    text = text.replace(/[,\s]+$/, '').trim();
    return text;
  }

  // ===== AUTO-DETECT & NOTIFICATION =====
  function showBadge(count) {
    chrome.runtime.sendMessage({ type: 'updateBadge', count: count });
  }

  // Run extraction on page load and send count to badge
  function autoScan() {
    var events = extractEvents();
    showBadge(events.length);
    return events;
  }

  // Expose for popup to call
  window.__yfevents_extract = extractEvents;
  window.__yfevents_scan = autoScan;

  // Initial scan after short delay
  setTimeout(autoScan, 3000);

  // Watch for DOM changes (infinite scroll)
  var observer = new MutationObserver(function() {
    clearTimeout(window.__yfevents_debounce);
    window.__yfevents_debounce = setTimeout(autoScan, 2000);
  });
  observer.observe(document.body, { childList: true, subtree: true });

})();

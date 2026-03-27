// ===== CONFIG =====
var DEFAULT_URL = 'https://yfevents.yakimafinds.com';
var apiUrl = DEFAULT_URL;
var apiKey = '';

// Load config
chrome.storage.local.get(['apiUrl', 'apiKey'], function(data) {
  apiUrl = data.apiUrl || DEFAULT_URL;
  apiKey = data.apiKey || '';
  document.getElementById('cfg-url').value = apiUrl;
  document.getElementById('cfg-key').value = apiKey;
  checkConnection();
});

// Check if we're on Facebook events - show special button
chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
  if (tabs[0] && tabs[0].url && tabs[0].url.indexOf('facebook.com/events') >= 0) {
    document.getElementById('btn-fb-extract').classList.remove('hidden');
  }
});

// ===== MODE TABS =====
document.querySelectorAll('.mode-tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.mode-tab').forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    var mode = tab.getAttribute('data-mode');
    ['capture', 'events', 'dom', 'config'].forEach(function(m) {
      var el = document.getElementById('mode-' + m);
      if (el) el.classList.toggle('hidden', m !== mode);
    });
  });
});

// ===== CONNECTION CHECK =====
function checkConnection() {
  var statusEl = document.getElementById('status');
  fetch(apiUrl + '/api/auth/status', { method: 'GET' })
    .then(function(r) {
      statusEl.textContent = 'Connected to ' + apiUrl;
      statusEl.className = 'status connected';
    })
    .catch(function() {
      statusEl.textContent = 'Cannot reach ' + apiUrl;
      statusEl.className = 'status disconnected';
    });
}

// ===== CONFIG BUTTONS =====
document.getElementById('btn-save-config').addEventListener('click', function() {
  apiUrl = document.getElementById('cfg-url').value.replace(/\/+$/, '') || DEFAULT_URL;
  apiKey = document.getElementById('cfg-key').value;
  chrome.storage.local.set({ apiUrl: apiUrl, apiKey: apiKey });
  checkConnection();
});

document.getElementById('btn-test-config').addEventListener('click', function() {
  checkConnection();
});

// ===== INJECT AND EXECUTE =====
function runInPage(func, callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs[0]) { callback({ error: 'No active tab' }); return; }
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: func
    }, function(results) {
      if (chrome.runtime.lastError) {
        callback({ error: chrome.runtime.lastError.message });
      } else if (results && results[0]) {
        callback(results[0].result);
      } else {
        callback({ error: 'No result' });
      }
    });
  });
}

// ===== CAPTURE PAGE CONTENT =====
document.getElementById('btn-capture').addEventListener('click', function() {
  var btn = this;
  btn.disabled = true;
  btn.textContent = 'Capturing...';

  runInPage(function() {
    // Capture visible text content, links, images, and metadata
    var result = {
      url: window.location.href,
      title: document.title,
      timestamp: new Date().toISOString(),
      meta: {},
      headings: [],
      links: [],
      images: [],
      textBlocks: []
    };

    // Meta tags
    document.querySelectorAll('meta[property], meta[name]').forEach(function(m) {
      var key = m.getAttribute('property') || m.getAttribute('name');
      if (key) result.meta[key] = m.getAttribute('content');
    });

    // Headings
    document.querySelectorAll('h1, h2, h3').forEach(function(h) {
      var text = h.textContent.trim();
      if (text && text.length < 200) result.headings.push({ tag: h.tagName, text: text });
    });

    // Visible text blocks with potential event info
    var datePatterns = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2}|\d{4})\b/i;
    var timePatterns = /\b\d{1,2}:\d{2}\s*(am|pm|AM|PM)?\b/;

    // Get all visible text containers
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode: function(node) {
        var style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return NodeFilter.FILTER_REJECT;
        var tag = node.tagName;
        if (['SCRIPT','STYLE','NOSCRIPT','SVG','PATH'].indexOf(tag) >= 0) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    var seen = new Set();
    var node;
    while (node = walker.nextNode()) {
      var text = '';
      // Get direct text content (not from children)
      for (var i = 0; i < node.childNodes.length; i++) {
        if (node.childNodes[i].nodeType === 3) text += node.childNodes[i].textContent;
      }
      text = text.trim();
      if (text.length > 10 && text.length < 500 && !seen.has(text)) {
        seen.add(text);
        var hasDate = datePatterns.test(text);
        var hasTime = timePatterns.test(text);
        if (hasDate || hasTime || text.length > 30) {
          result.textBlocks.push({
            text: text,
            tag: node.tagName,
            classes: node.className ? String(node.className).substring(0, 100) : '',
            hasDate: hasDate,
            hasTime: hasTime,
            rect: (function() { var r = node.getBoundingClientRect(); return { top: Math.round(r.top), left: Math.round(r.left) }; })()
          });
        }
      }
    }

    // Links with event-like URLs
    document.querySelectorAll('a[href]').forEach(function(a) {
      var href = a.href;
      var text = a.textContent.trim().substring(0, 150);
      if (text && (href.indexOf('event') >= 0 || href.indexOf('calendar') >= 0 ||
          datePatterns.test(text) || href.indexOf('/e/') >= 0)) {
        result.links.push({ href: href, text: text });
      }
    });

    // Limit sizes
    result.textBlocks = result.textBlocks.slice(0, 100);
    result.links = result.links.slice(0, 50);

    return result;
  }, function(data) {
    btn.disabled = false;
    btn.textContent = 'Capture Page Content';
    var box = document.getElementById('capture-result');
    var pre = document.getElementById('capture-text');
    box.classList.remove('hidden');
    if (data.error) {
      pre.textContent = 'Error: ' + data.error;
    } else {
      pre.textContent = JSON.stringify(data, null, 2);
      // Also send to server
      sendToServer('/api/scraper/page-capture', data);
    }
  });
});

// ===== FIND EVENTS ON PAGE =====
document.getElementById('btn-capture-events').addEventListener('click', function() {
  var btn = this;
  btn.disabled = true;
  btn.textContent = 'Scanning...';

  runInPage(function() {
    var events = [];
    var url = window.location.href;

    // Strategy 1: Look for structured data (JSON-LD, microdata)
    document.querySelectorAll('script[type="application/ld+json"]').forEach(function(s) {
      try {
        var data = JSON.parse(s.textContent);
        var items = Array.isArray(data) ? data : [data];
        items.forEach(function(item) {
          if (item['@type'] === 'Event' || (item['@graph'] && item['@graph'].find(function(g) { return g['@type'] === 'Event'; }))) {
            var ev = item['@type'] === 'Event' ? item : item['@graph'].find(function(g) { return g['@type'] === 'Event'; });
            events.push({
              source: 'json-ld',
              title: ev.name,
              startDate: ev.startDate,
              endDate: ev.endDate,
              location: ev.location ? (ev.location.name || ev.location.address || JSON.stringify(ev.location)) : null,
              description: ev.description ? ev.description.substring(0, 300) : null,
              url: ev.url || url,
              image: ev.image ? (typeof ev.image === 'string' ? ev.image : ev.image.url) : null,
              organizer: ev.organizer ? (ev.organizer.name || ev.organizer) : null
            });
          }
        });
      } catch(e) {}
    });

    // Strategy 2: Look for common event card patterns
    // Cards with date + title + location grouped together
    var containers = document.querySelectorAll('[role="article"], [data-testid], [class*="event"], [class*="Event"]');
    containers.forEach(function(el) {
      var text = el.textContent;
      if (text.length < 20 || text.length > 5000) return;

      // Look for date patterns
      var dateMatch = text.match(/(\w+,\s+\w+\s+\d{1,2}(?:,\s+\d{4})?|\d{1,2}\/\d{1,2}\/\d{2,4}|\w+\s+\d{1,2},\s+\d{4})/);
      var timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?(?:\s*[-–]\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)?)/);

      if (dateMatch) {
        // Try to extract title (usually the first heading or bold text)
        var titleEl = el.querySelector('h1, h2, h3, h4, [role="heading"], strong, b, [class*="title"], [class*="Title"]');
        var title = titleEl ? titleEl.textContent.trim() : null;
        if (!title) {
          // First significant text line
          var lines = text.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 5 && l.length < 150; });
          title = lines[0] || null;
        }

        // Link
        var linkEl = el.querySelector('a[href*="event"], a[href*="/e/"], a[href]');
        var eventUrl = linkEl ? linkEl.href : null;

        // Image
        var imgEl = el.querySelector('img[src]');
        var image = imgEl ? imgEl.src : null;

        // Location (text near address-like patterns)
        var locMatch = text.match(/(?:at|@|Location:|Venue:)\s*([^\n]{5,80})/i);
        var location = locMatch ? locMatch[1].trim() : null;

        if (title && title !== dateMatch[0]) {
          events.push({
            source: 'dom-pattern',
            title: title.substring(0, 200),
            startDate: dateMatch[0],
            time: timeMatch ? timeMatch[0] : null,
            location: location,
            url: eventUrl || url,
            image: image,
            description: text.substring(0, 300).replace(/\s+/g, ' ').trim(),
            element: {
              tag: el.tagName,
              classes: String(el.className).substring(0, 150),
              role: el.getAttribute('role'),
              testId: el.getAttribute('data-testid'),
              ariaLabel: el.getAttribute('aria-label')
            }
          });
        }
      }
    });

    // Strategy 3: Look for <time> elements grouped with links
    document.querySelectorAll('time[datetime]').forEach(function(timeEl) {
      var parent = timeEl.closest('[role="article"], li, div[class], article, section') || timeEl.parentElement.parentElement;
      if (!parent) return;
      var existing = events.find(function(e) { return parent.contains(timeEl); });
      if (existing) return;

      var linkEl = parent.querySelector('a[href]');
      var titleEl = parent.querySelector('h1, h2, h3, h4, [role="heading"], strong');
      if (titleEl) {
        events.push({
          source: 'time-element',
          title: titleEl.textContent.trim().substring(0, 200),
          startDate: timeEl.getAttribute('datetime'),
          displayDate: timeEl.textContent.trim(),
          url: linkEl ? linkEl.href : url,
          image: (parent.querySelector('img[src]') || {}).src || null,
          location: null,
          element: {
            tag: parent.tagName,
            classes: String(parent.className).substring(0, 150)
          }
        });
      }
    });

    // Strategy 4: Heading-based event listings (e.g., visityakima.com)
    // Detects patterns like: H2(title) + H2/H3(date) or H3(date) + H2(title)
    var allHeadings = Array.from(document.querySelectorAll('h1, h2, h3, h4'));
    var datePattern = /^(?:(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:\s*[-–]\s*(?:(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+)?\d{1,2})?(?:,?\s*\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)$/i;
    var locationPattern = /^(?:yakima|selah|union gap|prosser|sunnyside|zillah|naches|tieton|ellensburg|toppenish|wapato|grandview|goldendale)/i;
    var skipTitles = /^(?:email|find|search|get|must see|featured|upcoming|what's|wine country|beer|live music|festival|inspiration)/i;

    for (var hi = 0; hi < allHeadings.length - 1; hi++) {
      var h = allHeadings[hi];
      var hNext = allHeadings[hi + 1];
      var hText = h.textContent.trim();
      var hNextText = hNext.textContent.trim();

      var title = null, dateStr = null, location = null, imgSrc = null, eventUrl = null;

      // Pattern A: title heading followed by date heading (optionally then location)
      if (!datePattern.test(hText) && !skipTitles.test(hText) && hText.length > 5 && hText.length < 200 && datePattern.test(hNextText)) {
        title = hText;
        dateStr = hNextText;
        // Check if there's a location heading after the date
        if (hi + 2 < allHeadings.length) {
          var hLoc = allHeadings[hi + 2].textContent.trim();
          if (locationPattern.test(hLoc) && hLoc.length < 80) {
            location = hLoc;
          }
        }
      }
      // Pattern B: date heading followed by title heading
      else if (datePattern.test(hText) && !datePattern.test(hNextText) && !skipTitles.test(hNextText) && hNextText.length > 5 && hNextText.length < 200) {
        dateStr = hText;
        title = hNextText;
      }

      if (title && dateStr) {
        // Find nearest link and image
        var container = h.closest('li, article, div, section') || h.parentElement;
        if (container) {
          var linkEl = container.querySelector('a[href]');
          eventUrl = linkEl ? linkEl.href : null;
          var imgEl = container.querySelector('img[src]');
          imgSrc = imgEl ? imgEl.src : null;
        }

        events.push({
          source: 'heading-pattern',
          title: title,
          startDate: dateStr,
          location: location,
          url: eventUrl || url,
          image: imgSrc,
          description: null,
          element: { tag: h.tagName, classes: String(h.className).substring(0, 100) }
        });
      }
    }

    // Deduplicate by title
    var seen = {};
    events = events.filter(function(e) {
      if (!e.title) return false;
      var key = e.title.toLowerCase().substring(0, 50);
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });

    return { url: url, title: document.title, eventCount: events.length, events: events };
  }, function(data) {
    btn.disabled = false;
    btn.textContent = 'Find Events on Page';

    if (data.error) {
      alert('Error: ' + data.error);
      return;
    }

    // Show events tab
    document.querySelectorAll('.mode-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelector('[data-mode="events"]').classList.add('active');
    document.getElementById('mode-capture').classList.add('hidden');
    document.getElementById('mode-events').classList.remove('hidden');

    var countBadge = document.getElementById('event-count');
    countBadge.textContent = data.eventCount;
    countBadge.classList.toggle('hidden', data.eventCount === 0);

    var list = document.getElementById('events-list');
    while (list.firstChild) list.removeChild(list.firstChild);

    if (data.events.length === 0) {
      var p = document.createElement('p');
      p.style.cssText = 'font-size:12px;color:#6b7280;text-align:center;padding:16px;';
      p.textContent = 'No events detected on this page. Try "Capture Page Content" or "Explore DOM" for raw data.';
      list.appendChild(p);
    } else {
      data.events.forEach(function(ev) {
        var card = document.createElement('div');
        card.className = 'event-card';

        var title = document.createElement('div');
        title.className = 'ev-title';
        title.textContent = ev.title;
        card.appendChild(title);

        if (ev.startDate || ev.displayDate) {
          var date = document.createElement('div');
          date.className = 'ev-date';
          date.textContent = ev.displayDate || ev.startDate;
          if (ev.time) date.textContent += ' at ' + ev.time;
          card.appendChild(date);
        }

        if (ev.location) {
          var loc = document.createElement('div');
          loc.className = 'ev-loc';
          loc.textContent = ev.location;
          card.appendChild(loc);
        }

        var src = document.createElement('div');
        src.style.cssText = 'font-size:10px;color:#b7410e;margin-top:4px;';
        src.textContent = 'via ' + ev.source;
        card.appendChild(src);

        list.appendChild(card);
      });

      document.getElementById('btn-send-events').classList.remove('hidden');
    }

    // Store for sending
    window._capturedEvents = data;
  });
});

// ===== SEND EVENTS =====
document.getElementById('btn-send-events').addEventListener('click', function() {
  var btn = this;
  if (!window._capturedEvents) return;
  btn.disabled = true;
  btn.textContent = 'Sending...';

  // Send to import endpoint (deduplicates automatically)
  sendToServer('/api/scraper/page-capture/import', { events: window._capturedEvents.events }, function(ok, msg) {
    btn.disabled = false;
    btn.textContent = 'Send All to YFEvents';
    var box = document.getElementById('send-result');
    var pre = document.getElementById('send-text');
    box.classList.remove('hidden');
    if (ok) {
      try {
        var res = JSON.parse(msg);
        pre.textContent = 'Added: ' + res.added + ' | Duplicates skipped: ' + res.duplicate + ' | Invalid: ' + res.invalid;
      } catch(e) {
        pre.textContent = 'Sent successfully! ' + msg;
      }
    } else {
      pre.textContent = 'Error: ' + msg;
    }
  });
});

// ===== DOM EXPLORER =====
document.getElementById('btn-capture-dom').addEventListener('click', function() {
  var btn = this;
  btn.disabled = true;
  btn.textContent = 'Analyzing...';

  runInPage(function() {
    var report = {
      url: window.location.href,
      title: document.title,
      timestamp: new Date().toISOString(),
      summary: {},
      interestingElements: [],
      repeatingPatterns: [],
      ariaLandmarks: [],
      dataAttributes: []
    };

    // Count element types
    var tagCounts = {};
    document.querySelectorAll('*').forEach(function(el) {
      tagCounts[el.tagName] = (tagCounts[el.tagName] || 0) + 1;
    });
    report.summary.totalElements = Object.values(tagCounts).reduce(function(a, b) { return a + b; }, 0);
    report.summary.tagCounts = tagCounts;

    // Find elements with role, aria-label, data-testid (stable selectors)
    document.querySelectorAll('[role]').forEach(function(el) {
      var role = el.getAttribute('role');
      var label = el.getAttribute('aria-label');
      var text = el.textContent.substring(0, 100).trim();
      if (role && ['article', 'listitem', 'link', 'heading', 'button', 'main', 'navigation', 'region'].indexOf(role) >= 0) {
        report.ariaLandmarks.push({
          role: role,
          ariaLabel: label,
          tag: el.tagName,
          classes: String(el.className).substring(0, 80),
          textPreview: text.substring(0, 80),
          childCount: el.children.length
        });
      }
    });
    report.ariaLandmarks = report.ariaLandmarks.slice(0, 30);

    // Find data-testid attributes
    document.querySelectorAll('[data-testid]').forEach(function(el) {
      report.dataAttributes.push({
        testId: el.getAttribute('data-testid'),
        tag: el.tagName,
        textPreview: el.textContent.substring(0, 60).trim()
      });
    });
    report.dataAttributes = report.dataAttributes.slice(0, 30);

    // Find repeating card-like structures
    var parentChildCounts = new Map();
    document.querySelectorAll('div, ul, section, article').forEach(function(parent) {
      if (parent.children.length >= 3) {
        // Check if children are similar
        var firstChild = parent.children[0];
        var firstTag = firstChild.tagName;
        var firstClass = String(firstChild.className);
        var similar = 0;
        for (var i = 1; i < parent.children.length; i++) {
          if (parent.children[i].tagName === firstTag && String(parent.children[i].className) === firstClass) similar++;
        }
        if (similar >= 2) {
          var sampleText = firstChild.textContent.substring(0, 150).trim();
          report.repeatingPatterns.push({
            parentTag: parent.tagName,
            parentClasses: String(parent.className).substring(0, 100),
            parentRole: parent.getAttribute('role'),
            childCount: parent.children.length,
            similarChildren: similar + 1,
            childTag: firstTag,
            childClasses: firstClass.substring(0, 100),
            sampleText: sampleText,
            childRole: firstChild.getAttribute('role'),
            hasLinks: firstChild.querySelectorAll('a').length > 0,
            hasImages: firstChild.querySelectorAll('img').length > 0,
            hasTime: firstChild.querySelectorAll('time').length > 0 || /\b\d{1,2}:\d{2}\b/.test(sampleText)
          });
        }
      }
    });

    // Sort by child count descending, take top 15
    report.repeatingPatterns.sort(function(a, b) { return b.similarChildren - a.similarChildren; });
    report.repeatingPatterns = report.repeatingPatterns.slice(0, 15);

    return report;
  }, function(data) {
    btn.disabled = false;
    btn.textContent = 'Explore DOM Structure';

    // Show DOM tab
    document.querySelectorAll('.mode-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelector('[data-mode="dom"]').classList.add('active');
    document.getElementById('mode-capture').classList.add('hidden');
    document.getElementById('mode-dom').classList.remove('hidden');

    var box = document.getElementById('dom-result');
    var pre = document.getElementById('dom-text');
    box.classList.remove('hidden');
    if (data.error) {
      pre.textContent = 'Error: ' + data.error;
    } else {
      pre.textContent = JSON.stringify(data, null, 2);
      sendToServer('/api/scraper/page-capture', { type: 'dom-report', data: data });
    }
  });
});

// ===== FACEBOOK EXTRACT =====
document.getElementById('btn-fb-extract').addEventListener('click', function() {
  var btn = this;
  btn.disabled = true;
  btn.textContent = 'Extracting...';

  // Call the content script's extraction function
  runInPage(function() {
    if (window.__yfevents_extract) {
      return { events: window.__yfevents_extract(), url: window.location.href };
    }
    // Content script not loaded — do full inline extraction
    var MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };

    function applyTime(d, timeStr, ampm) {
      var parts = timeStr.split(':');
      var hours = parseInt(parts[0]);
      var mins = parts.length > 1 ? parseInt(parts[1]) : 0;
      if (ampm.toLowerCase() === 'pm' && hours < 12) hours += 12;
      if (ampm.toLowerCase() === 'am' && hours === 12) hours = 0;
      d.setHours(hours, mins, 0, 0);
      return d.toISOString();
    }

    function parseDateText(text) {
      var now = new Date();
      var lower = text.toLowerCase().trim();
      // Relative dates
      if (lower.indexOf('tomorrow') === 0) {
        var d = new Date(now); d.setDate(d.getDate() + 1);
        var tm = text.match(/at\s+(\d{1,2}(?::\d{2})?)\s*(am|pm)/i);
        return tm ? applyTime(d, tm[1], tm[2]) : d.toISOString().split('T')[0];
      }
      if (lower.indexOf('today') === 0) {
        var d = new Date(now);
        var tm = text.match(/at\s+(\d{1,2}(?::\d{2})?)\s*(am|pm)/i);
        return tm ? applyTime(d, tm[1], tm[2]) : d.toISOString().split('T')[0];
      }
      var thisDayMatch = lower.match(/this\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+(\d{1,2}(?::\d{2})?)\s*(am|pm)/i);
      if (thisDayMatch) {
        var targetDay = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(thisDayMatch[1].toLowerCase());
        var d = new Date(now);
        var diff = (targetDay - d.getDay() + 7) % 7;
        if (diff === 0) diff = 7;
        d.setDate(d.getDate() + diff);
        return applyTime(d, thisDayMatch[2], thisDayMatch[3]);
      }
      // Absolute dates
      var match = text.match(/(?:mon|tue|wed|thu|fri|sat|sun)\w*,?\s+(\w+)\s+(\d{1,2})(?:\s*[-–]\s*(?:\w+\s+)?(\d{1,2}))?(?:,?\s+(\d{4}))?(?:\s+at\s+(\d{1,2}(?::\d{2})?)\s*(am|pm))?/i);
      if (match) {
        var monthStr = match[1].toLowerCase().substring(0, 3);
        var month = MONTHS[monthStr];
        if (month === undefined) return text;
        var day = parseInt(match[2]);
        var year = match[4] ? parseInt(match[4]) : now.getFullYear();
        var d = new Date(year, month, day);
        if (!match[4] && d < now) d.setFullYear(d.getFullYear() + 1);
        return match[5] ? applyTime(d, match[5], match[6]) : d.toISOString().split('T')[0];
      }
      return text;
    }

    var events = [];
    var seenIds = {};

    // Pass 1: collect all event links
    document.querySelectorAll('a[href*="/events/"]').forEach(function(link) {
      var idMatch = link.href.match(/\/events\/(\d{10,})/);
      if (!idMatch) return;
      var fbId = idMatch[1];
      if (seenIds[fbId]) return;
      if (link.href.indexOf('calendar') >= 0 || link.href.indexOf('create') >= 0 ||
          link.href.indexOf('notifications') >= 0 || link.href.indexOf('birthdays') >= 0) return;

      var text = link.textContent.trim();
      if (text.length < 10) return;

      var hasDate = /(?:mon|tue|wed|thu|fri|sat|sun|today|tomorrow|this\s+\w+day)/i.test(text);
      if (!hasDate && text.length < 150) {
        seenIds[fbId] = { title: text, fbId: fbId, url: link.href.split('?')[0] };
      } else if (hasDate) {
        seenIds[fbId] = { fullText: text, fbId: fbId, url: link.href.split('?')[0] };
      }
    });

    // Pass 2: assemble events
    Object.keys(seenIds).forEach(function(fbId) {
      var info = seenIds[fbId];
      var event = {
        source: 'facebook',
        sourceId: 'fb-' + fbId,
        facebookId: fbId,
        url: 'https://www.facebook.com/events/' + fbId + '/',
        title: null,
        startDate: null,
        location: null,
        _rawDate: null
      };

      if (info.title && !info.fullText) {
        event.title = info.title;
        // Try to find date from nearby elements
        var linkEl = document.querySelector('a[href*="' + fbId + '"]');
        if (linkEl) {
          var card = linkEl.parentElement && linkEl.parentElement.parentElement && linkEl.parentElement.parentElement.parentElement;
          if (card) {
            var spans = card.querySelectorAll('span');
            for (var i = 0; i < spans.length; i++) {
              var st = spans[i].textContent.trim();
              if (/^(?:(?:mon|tue|wed|thu|fri|sat|sun)\w*,?\s+|today|tomorrow|this\s+)/i.test(st) && st.length < 60) {
                event.startDate = parseDateText(st);
                event._rawDate = st;
                break;
              }
            }
          }
        }
      } else if (info.fullText) {
        var text = info.fullText;
        var dateMatch = text.match(/^((?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*,?\s+\w+\s+\d{1,2}(?:\s*[-–]\s*(?:\w+\s+)?\d{1,2})?(?:,?\s+\d{4})?(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM))?)|(?:Tomorrow\s+at\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM))|(?:Today\s+at\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM))|(?:This\s+\w+day\s+at\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM)))/i);
        if (dateMatch) {
          event._rawDate = dateMatch[1];
          event.startDate = parseDateText(dateMatch[1]);
          var rest = text.substring(dateMatch[0].length);
          // Split: title ends before address patterns or action words
          var actionSplit = rest.match(/^(.*?)(?:Interested|Going|Share|More$)/);
          var meaningful = actionSplit ? actionSplit[1] : rest;
          var locSplit = meaningful.match(/^(.+?)(\d+\s+(?:N\.?|S\.?|E\.?|W\.?)?\s*(?:\w+\s+){1,3}(?:St|Ave|Blvd|Rd|Dr|Ln|Way|Hwy|Road|Street|Avenue|Drive)[\s\S]*)/i);
          if (locSplit) {
            event.title = locSplit[1].trim();
            event.location = locSplit[2].replace(/(?:Interested|Going|Share|More).*$/, '').trim();
          } else {
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
      }

      if (event.title && event.title.length > 3) {
        events.push(event);
      }
    });

    return { events: events, url: window.location.href };
  }, function(data) {
    btn.disabled = false;
    btn.textContent = 'Import Facebook Events';

    if (data.error) { alert('Error: ' + data.error); return; }

    var events = data.events || [];

    // Switch to events tab
    document.querySelectorAll('.mode-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelector('[data-mode="events"]').classList.add('active');
    document.getElementById('mode-capture').classList.add('hidden');
    document.getElementById('mode-events').classList.remove('hidden');

    var countBadge = document.getElementById('event-count');
    countBadge.textContent = events.length;
    countBadge.classList.toggle('hidden', events.length === 0);

    var list = document.getElementById('events-list');
    while (list.firstChild) list.removeChild(list.firstChild);

    if (events.length === 0) {
      var p = document.createElement('p');
      p.style.cssText = 'font-size:12px;color:#6b7280;text-align:center;padding:16px;';
      p.textContent = 'No Facebook events found. Scroll down to load more events, then try again.';
      list.appendChild(p);
    } else {
      events.forEach(function(ev) {
        var card = document.createElement('div');
        card.className = 'event-card';

        var title = document.createElement('div');
        title.className = 'ev-title';
        title.textContent = ev.title || 'Untitled';
        card.appendChild(title);

        if (ev.startDate || ev._rawDate) {
          var date = document.createElement('div');
          date.className = 'ev-date';
          date.textContent = ev._rawDate || ev.startDate;
          card.appendChild(date);
        }

        if (ev.location || ev.venue) {
          var loc = document.createElement('div');
          loc.className = 'ev-loc';
          loc.textContent = ev.venue ? ev.venue + (ev.location ? ' - ' + ev.location : '') : ev.location;
          card.appendChild(loc);
        }

        if (ev.facebookId) {
          var idEl = document.createElement('div');
          idEl.style.cssText = 'font-size:10px;color:#6b7280;margin-top:2px;';
          idEl.textContent = 'fb:' + ev.facebookId;
          card.appendChild(idEl);
        }

        list.appendChild(card);
      });

      document.getElementById('btn-send-events').classList.remove('hidden');
    }

    window._capturedEvents = { url: data.url, source: 'facebook-extension', events: events, eventCount: events.length };
  });
});

// ===== SEND TO SERVER =====
function sendToServer(path, data, callback) {
  var headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['X-API-Key'] = apiKey;

  fetch(apiUrl + path, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(data)
  })
  .then(function(r) { return r.json().then(function(j) { return { ok: r.ok, data: j }; }); })
  .then(function(res) {
    if (callback) callback(res.ok, JSON.stringify(res.data));
  })
  .catch(function(err) {
    if (callback) callback(false, err.message);
  });
}

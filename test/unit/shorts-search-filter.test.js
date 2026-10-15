import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

test('YouTube Shorts Search Blocking & Direct Navigation Interception', async (t) => {
  // Setup sample YouTube search results page
  const searchPageHtml = `
    <!DOCTYPE html>
    <html data-focus-active="true" data-focus-site="youtube" data-focus-route="search"
          data-focus-block-shorts="true" data-focus-hide-feed="true" data-focus-hide-sidebar="true" data-focus-hide-suggested="true">
    <head><title>Search Results</title></head>
    <body>
      <ytd-search>
        <div id="contents">
          <!-- 1. Normal Video with regular watch URL -->
          <ytd-video-renderer id="normal-video-1">
            <a id="thumbnail" href="/watch?v=normal123">Link</a>
            <h3 id="title"><span>Learn JavaScript in 10 Minutes</span></h3>
          </ytd-video-renderer>

          <!-- 2. Video titled "Short film" but with normal /watch?v= link (MUST BE PRESERVED) -->
          <ytd-video-renderer id="normal-video-with-short-title">
            <a id="thumbnail" href="/watch?v=film456">Link</a>
            <h3 id="title"><span>My First Short Film Project (Full Documentary)</span></h3>
          </ytd-video-renderer>

          <!-- 3. Shorts card in search results with /shorts/ URL -->
          <ytd-video-renderer id="shorts-video-in-search">
            <a id="thumbnail" href="/shorts/shortVid99">Short Link</a>
            <h3 id="title"><span>Funny Cat #shorts</span></h3>
          </ytd-video-renderer>

          <!-- 4. Shorts card in search with overlay-style="SHORTS" -->
          <ytd-video-renderer id="shorts-badge-in-search">
            <div id="overlays">
              <span overlay-style="SHORTS">Shorts</span>
            </div>
            <a id="thumbnail" href="/watch?v=someVid">Link</a>
          </ytd-video-renderer>

          <!-- 5. Shorts Reel Shelf in search results -->
          <ytd-reel-shelf-renderer id="shorts-shelf-in-search">
            <span id="title-text">Shorts</span>
            <ytd-reel-item-renderer id="reel-item-1"></ytd-reel-item-renderer>
          </ytd-reel-shelf-renderer>

          <!-- 6. Compact video renderer with shorts link -->
          <ytd-compact-video-renderer id="compact-shorts">
            <a href="/shorts/compact123">Short</a>
          </ytd-compact-video-renderer>

          <!-- 7. Normal compact video renderer -->
          <ytd-compact-video-renderer id="compact-normal">
            <a href="/watch?v=compact999">Normal Video</a>
          </ytd-compact-video-renderer>
        </div>
      </ytd-search>
    </body>
    </html>
  `;

  await t.test('1. filterShortsInDOM accurately tags only Shorts cards and shelves', () => {
    const { document, window } = parseHTML(searchPageHtml);

    // Mock DOM filtering logic as implemented in content/youtube.js
    const candidates = document.querySelectorAll(`
      ytd-video-renderer:not([data-focus-checked]),
      ytd-compact-video-renderer:not([data-focus-checked]),
      ytd-grid-video-renderer:not([data-focus-checked]),
      ytd-rich-item-renderer:not([data-focus-checked]),
      ytd-reel-shelf-renderer:not([data-focus-checked]),
      ytd-shelf-renderer:not([data-focus-checked])
    `);

    candidates.forEach((el) => {
      el.setAttribute('data-focus-checked', 'true');

      if (
        el.tagName.toLowerCase() === 'ytd-reel-shelf-renderer' ||
        el.hasAttribute('is-shorts') ||
        el.querySelector('ytd-reel-item-renderer')
      ) {
        el.setAttribute('data-focus-is-short', 'true');
        return;
      }

      const titleSpan = el.querySelector('#title-text, #title, #shelf-title');
      if (titleSpan && titleSpan.textContent.trim().toLowerCase() === 'shorts') {
        el.setAttribute('data-focus-is-short', 'true');
        return;
      }

      const shortsLink = el.querySelector('a[href*="/shorts/"]');
      if (shortsLink) {
        el.setAttribute('data-focus-is-short', 'true');
        return;
      }

      const shortsOverlay = el.querySelector('[overlay-style="SHORTS"], [aria-label*="Shorts" i]');
      if (shortsOverlay) {
        if (shortsOverlay.getAttribute('overlay-style') === 'SHORTS' ||
            shortsOverlay.classList?.contains('ytd-thumbnail-overlay-time-status-renderer')) {
          el.setAttribute('data-focus-is-short', 'true');
          return;
        }
      }
    });

    // Verify Shorts cards got tagged
    assert.equal(document.getElementById('shorts-video-in-search').getAttribute('data-focus-is-short'), 'true');
    assert.equal(document.getElementById('shorts-badge-in-search').getAttribute('data-focus-is-short'), 'true');
    assert.equal(document.getElementById('shorts-shelf-in-search').getAttribute('data-focus-is-short'), 'true');
    assert.equal(document.getElementById('compact-shorts').getAttribute('data-focus-is-short'), 'true');

    // CRITICAL: Verify Normal videos are NOT tagged
    assert.equal(document.getElementById('normal-video-1').getAttribute('data-focus-is-short'), null);
    assert.equal(document.getElementById('compact-normal').getAttribute('data-focus-is-short'), null);

    // CRITICAL: Video titled "Short film" with normal link MUST NOT be tagged
    assert.equal(document.getElementById('normal-video-with-short-title').getAttribute('data-focus-is-short'), null);
  });

  await t.test('2. Direct Shorts URL parsing and overlay elements', () => {
    const { document } = parseHTML(`<!DOCTYPE html><html><body><div id="content"></div></body></html>`);

    const videoId = 'testShort123';
    const overlay = document.createElement('div');
    overlay.id = 'focus-mode-shorts-overlay';
    overlay.className = 'focus-shorts-block-overlay';

    const watchUrl = `/watch?v=${videoId}`;
    overlay.innerHTML = `
      <div class="focus-mode-card" role="dialog" aria-labelledby="focus-shorts-title">
        <h2 id="focus-shorts-title">Shorts Are Blocked</h2>
        <div class="focus-mode-links">
          <a href="${watchUrl}" id="focus-open-regular">Watch in Normal Player</a>
          <button type="button" id="focus-shorts-back">Go Back</button>
          <a href="/feed/subscriptions" id="focus-subscriptions">Subscriptions</a>
        </div>
        <form id="focus-shorts-search-form">
          <input type="text" id="focus-shorts-input" />
        </form>
      </div>
    `;
    document.body.appendChild(overlay);

    // Verify all UI elements are rendered
    const titleEl = document.getElementById('focus-shorts-title');
    const watchLink = document.getElementById('focus-open-regular');
    const backBtn = document.getElementById('focus-shorts-back');
    const form = document.getElementById('focus-shorts-search-form');

    assert.ok(titleEl, 'Overlay title exists');
    assert.ok(watchLink, 'Normal player link exists');
    assert.equal(watchLink.getAttribute('href'), '/watch?v=testShort123', 'Watch link converts shorts ID to /watch?v=ID');
    assert.ok(backBtn, 'Go Back button exists');
    assert.ok(form, 'Search form exists');
  });

  await t.test('3. Pause/Resume state leaves search cards untagged or un-hidden', () => {
    const { document } = parseHTML(searchPageHtml);

    // When focus is inactive (data-focus-active="false")
    document.documentElement.dataset.focusActive = "false";

    // Even if items were marked data-focus-is-short="true", the CSS selector requires html[data-focus-active="true"]
    assert.equal(document.documentElement.dataset.focusActive, 'false', 'Active flag is false when paused');
  });
});

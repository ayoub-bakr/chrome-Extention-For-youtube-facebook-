/**
 * Focus Mode - YouTube Site Adapter
 * Implements route classification, direct Shorts interception, and Search-First UI.
 */

(function () {
  'use strict';

  const SITE_NAME = 'youtube';
  const shared = window.__FocusModeShared;
  if (!shared) return;

  /**
   * Classify the current YouTube route based on pathname and query
   */
  function classifyRoute(urlStr = window.location.href) {
    try {
      const url = new URL(urlStr);
      const path = url.pathname;

      if (path === '/' || path === '') return 'home';
      if (path.startsWith('/shorts')) return 'shorts';
      if (path === '/watch') return 'watch';
      if (path === '/results') return 'search';
      if (path.startsWith('/feed/subscriptions')) return 'subscriptions';
      if (path.startsWith('/feed/history') || path.startsWith('/feed/library')) return 'library';
      if (path.startsWith('/@') || path.startsWith('/channel/') || path.startsWith('/c/') || path.startsWith('/user/')) return 'channel';
      if (path.startsWith('/playlist')) return 'playlist';
      return 'other';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Extract video ID from direct Shorts URL
   */
  function getShortsVideoId(urlStr = window.location.href) {
    try {
      const url = new URL(urlStr);
      const match = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Main adapter logic
   */
  class YouTubeAdapter {
    constructor() {
      this.route = classifyRoute();
      this.active = false;
      this.config = {};
      this.searchCardEl = null;
      this.shortsOverlayEl = null;
    }

    async init() {
      await shared.loadSettings();
      this.syncState();

      // Listen to SPA route changes
      shared.onRouteChange((newUrl) => {
        this.route = classifyRoute(newUrl);
        this.syncState();
      });

      // Listen to settings changes from popup
      shared.onSettingsChange(() => {
        this.syncState();
      });

      // Periodic check for dynamic DOM insertion (e.g. search hero replacement)
      shared.createBatchObserver(() => {
        this.applyDomEnhancements();
      });

      // Initial execution
      this.applyDomEnhancements();
    }

    syncState() {
      this.config = shared.getSiteConfig(SITE_NAME);
      this.active = this.config.active;

      // Update document root attributes for declarative CSS rules
      shared.updateDocumentAttributes(SITE_NAME, this.route);

      // Manage direct Shorts blocking
      this.handleShortsRoute();

      // Manage Home Search-First UI
      this.handleHomeFeed();

      // Tag any Shorts elements in DOM
      this.filterShortsInDOM();
    }

    filterShortsInDOM() {
      if (!this.active || !this.config.blockShorts) return;

      // Select candidate cards/containers that could be shorts or shorts shelves
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

        // Check 1: Explicit shorts shelf or reel items
        if (
          el.tagName.toLowerCase() === 'ytd-reel-shelf-renderer' ||
          el.hasAttribute('is-shorts') ||
          el.querySelector('ytd-reel-item-renderer')
        ) {
          el.setAttribute('data-focus-is-short', 'true');
          return;
        }

        // Check 2: Header title indicates shorts shelf
        const titleSpan = el.querySelector('#title-text, #title, #shelf-title');
        if (titleSpan && titleSpan.textContent.trim().toLowerCase() === 'shorts') {
          el.setAttribute('data-focus-is-short', 'true');
          return;
        }

        // Check 3: Card contains link to /shorts/
        const shortsLink = el.querySelector('a[href*="/shorts/"]');
        if (shortsLink) {
          el.setAttribute('data-focus-is-short', 'true');
          return;
        }

        // Check 4: YouTube Shorts badge / overlay
        const shortsOverlay = el.querySelector('[overlay-style="SHORTS"], [aria-label*="Shorts" i]');
        if (shortsOverlay) {
          // Verify it's not just a general label like "Search" or ordinary title
          if (shortsOverlay.getAttribute('overlay-style') === 'SHORTS' ||
              shortsOverlay.classList.contains('ytd-thumbnail-overlay-time-status-renderer')) {
            el.setAttribute('data-focus-is-short', 'true');
            return;
          }
        }
      });
    }

    handleShortsRoute() {
      const isShortsRoute = this.route === 'shorts';
      const shouldBlock = this.active && this.config.blockShorts && isShortsRoute;

      // If should block direct Shorts URL
      if (shouldBlock) {
        // Pause and silence any active video
        const pauseAllVideos = () => {
          const videos = document.querySelectorAll('video');
          videos.forEach((v) => {
            try {
              v.muted = true;
              v.pause();
            } catch (e) {}
          });
        };

        pauseAllVideos();

        // Attach listener to prevent auto-play on direct shorts
        if (!this._shortsPlayListener) {
          this._shortsPlayListener = (e) => {
            if (this.route === 'shorts' && this.active && this.config.blockShorts) {
              try {
                e.target.pause();
                e.target.muted = true;
              } catch (err) {}
            }
          };
          window.addEventListener('play', this._shortsPlayListener, true);
        }

        const videoId = getShortsVideoId();
        if (!this.shortsOverlayEl) {
          this.renderShortsOverlay(videoId);
        } else {
          // If overlay already exists but user navigated to a different short, update link
          const openRegularBtn = this.shortsOverlayEl.querySelector('#focus-open-regular');
          if (openRegularBtn) {
            if (videoId) {
              openRegularBtn.href = `/watch?v=${videoId}`;
              openRegularBtn.style.display = 'inline-flex';
            } else {
              openRegularBtn.style.display = 'none';
            }
          }
        }
      } else {
        if (this.shortsOverlayEl) {
          this.shortsOverlayEl.remove();
          this.shortsOverlayEl = null;
        }
        if (this._shortsPlayListener) {
          window.removeEventListener('play', this._shortsPlayListener, true);
          this._shortsPlayListener = null;
        }
      }
    }

    renderShortsOverlay(videoId) {
      if (document.getElementById('focus-mode-shorts-overlay')) return;

      const overlay = document.createElement('div');
      overlay.id = 'focus-mode-shorts-overlay';
      overlay.className = 'focus-shorts-block-overlay';

      const watchUrl = videoId ? `/watch?v=${videoId}` : '/';

      overlay.innerHTML = `
        <div class="focus-mode-card" role="dialog" aria-labelledby="focus-shorts-title">
          <div class="focus-mode-badge warning">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            Shorts Blocked
          </div>
          <h2 id="focus-shorts-title" class="focus-mode-title">Shorts Are Blocked</h2>
          <p class="focus-mode-desc">
            Focus Mode protects your attention from infinite algorithmic vertical scrolls. You can watch this video in the standard player, return to your previous page, or search intentionally.
          </p>
          <div class="focus-mode-links" style="margin-bottom: 24px;">
            ${videoId ? `<a href="${watchUrl}" class="focus-mode-button primary" id="focus-open-regular">Watch in Normal Player</a>` : '<a href="#" class="focus-mode-button primary" id="focus-open-regular" style="display:none;">Watch in Normal Player</a>'}
            <button type="button" class="focus-mode-button secondary" id="focus-shorts-back">Go Back</button>
            <a href="/feed/subscriptions" class="focus-mode-button secondary">Subscriptions</a>
          </div>
          <form class="focus-mode-search-form" id="focus-shorts-search-form">
            <input type="text" class="focus-mode-search-input" placeholder="Search YouTube instead..." aria-label="Search YouTube" />
            <button type="submit" class="focus-mode-button primary">Search</button>
          </form>
        </div>
      `;

      // Event handlers
      const backBtn = overlay.querySelector('#focus-shorts-back');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          if (window.history.length > 1) {
            window.history.back();
          } else {
            window.location.href = '/';
          }
        });
      }

      const form = overlay.querySelector('#focus-shorts-search-form');
      const input = overlay.querySelector('.focus-mode-search-input');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = input.value.trim();
        if (query) {
          window.location.href = `/results?search_query=${encodeURIComponent(query)}`;
        }
      });

      const parent = document.body || document.documentElement;
      parent.appendChild(overlay);
      this.shortsOverlayEl = overlay;
      setTimeout(() => input.focus(), 100);
    }

    handleHomeFeed() {
      const isHome = this.route === 'home';
      const shouldShowSearchHero = this.active && (this.config.hideFeed || this.config.searchFirst) && isHome;

      if (!shouldShowSearchHero) {
        if (this.searchCardEl) {
          this.searchCardEl.remove();
          this.searchCardEl = null;
        }
        return;
      }

      this.renderSearchFirstHero();
    }

    renderSearchFirstHero() {
      if (document.getElementById('focus-mode-home-hero')) return;

      // Find the main container on home page
      const primaryContainer = document.querySelector('ytd-browse[page-subtype="home"] #primary') ||
                               document.querySelector('ytd-browse[page-subtype="home"]') ||
                               document.querySelector('#primary');

      if (!primaryContainer) return;

      const hero = document.createElement('div');
      hero.id = 'focus-mode-home-hero';
      hero.className = 'focus-mode-card';
      hero.setAttribute('role', 'region');
      hero.setAttribute('aria-label', 'Focus Mode Search-First Hub');

      hero.innerHTML = `
        <div class="focus-mode-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>
          Search-First Mode Active
        </div>
        <h1 class="focus-mode-title">What are you looking for today?</h1>
        <p class="focus-mode-desc">
          The algorithmic recommendation feed is hidden to help you browse with intention.
        </p>
        <form class="focus-mode-search-form" id="focus-home-search-form">
          <input type="text" class="focus-mode-search-input" id="focus-home-search-input" placeholder="Search YouTube intentionally..." aria-label="Search YouTube" autofocus />
          <button type="submit" class="focus-mode-button primary">Search</button>
        </form>
        <div class="focus-mode-links">
          <a href="/feed/subscriptions" class="focus-mode-button secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>
            Subscriptions
          </a>
          <a href="/feed/history" class="focus-mode-button secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            History
          </a>
        </div>
      `;

      // Wire search submission
      const form = hero.querySelector('#focus-home-search-form');
      const input = hero.querySelector('#focus-home-search-input');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = input.value.trim();
        if (query) {
          window.location.href = `/results?search_query=${encodeURIComponent(query)}`;
        }
      });

      primaryContainer.prepend(hero);
      this.searchCardEl = hero;

      // Automatically focus search input when searchFirst is enabled
      if (this.config.searchFirst) {
        setTimeout(() => {
          const ytSearchInput = document.querySelector('input#search') || input;
          if (ytSearchInput) ytSearchInput.focus();
        }, 150);
      }
    }

    applyDomEnhancements() {
      // Re-evaluate if route or elements changed
      const currentRoute = classifyRoute();
      if (currentRoute !== this.route) {
        this.route = currentRoute;
        this.syncState();
      }

      if (this.route === 'home' && this.active && (this.config.hideFeed || this.config.searchFirst)) {
        if (!document.getElementById('focus-mode-home-hero')) {
          this.renderSearchFirstHero();
        }
      }

      if (this.route === 'shorts' && this.active && this.config.blockShorts) {
        const videoEl = document.querySelector('video');
        if (videoEl && !videoEl.paused) {
          try { videoEl.pause(); } catch (e) {}
        }
        if (!document.getElementById('focus-mode-shorts-overlay')) {
          this.renderShortsOverlay(getShortsVideoId());
        }
      }

      // Filter any Shorts cards or shelves dynamically rendered in the DOM (e.g. search results, lazy scroll)
      this.filterShortsInDOM();
    }
  }

  // Bootstrap when shared is ready
  const adapter = new YouTubeAdapter();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => adapter.init());
  } else {
    adapter.init();
  }

  // Export for testing
  window.__FocusModeYouTube = {
    classifyRoute,
    getShortsVideoId,
    adapter
  };
})();

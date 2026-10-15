/**
 * Focus Mode - Facebook Site Adapter
 * Implements route classification, Reels interception, suggested post filtering,
 * and Search-First navigation while preserving groups, messages, and core sidebars.
 */

(function () {
  'use strict';

  const SITE_NAME = 'facebook';
  const shared = window.__FocusModeShared;
  if (!shared) return;

  const SUGGESTED_MARKERS = [
    'suggested for you',
    'suggested post',
    'popular across facebook',
    'follow',
    'sponsored',
    'join group'
  ];

  /**
   * Classify current Facebook route
   */
  function classifyRoute(urlStr = window.location.href) {
    try {
      const url = new URL(urlStr);
      const path = url.pathname;

      if (path === '/' || path === '') return 'home';
      if (path.startsWith('/reel') || path.startsWith('/reels')) return 'reels';
      if (path.startsWith('/search')) return 'search';
      if (path.startsWith('/groups')) return 'groups';
      if (path.startsWith('/pages')) return 'pages';
      if (path.startsWith('/messages')) return 'messages';
      if (path.includes('/posts/') || path.includes('/permalink')) return 'post';
      if (path.startsWith('/watch')) return 'watch';
      if (path.startsWith('/marketplace')) return 'marketplace';
      return 'other';
    } catch {
      return 'unknown';
    }
  }

  class FacebookAdapter {
    constructor() {
      this.route = classifyRoute();
      this.active = false;
      this.config = {};
      this.searchCardEl = null;
      this.reelsOverlayEl = null;
    }

    async init() {
      await shared.loadSettings();
      this.syncState();

      // Listen to SPA navigation
      shared.onRouteChange((newUrl) => {
        this.route = classifyRoute(newUrl);
        this.syncState();
      });

      // Listen to popup settings changes
      shared.onSettingsChange(() => {
        this.syncState();
      });

      // Periodic check for dynamic feed posts & DOM updates
      shared.createBatchObserver(() => {
        this.applyDomEnhancements();
      });

      this.applyDomEnhancements();
    }

    syncState() {
      this.config = shared.getSiteConfig(SITE_NAME);
      this.active = this.config.active;

      // Update document dataset attributes for CSS rules
      shared.updateDocumentAttributes(SITE_NAME, this.route);

      // Handle direct Reels
      this.handleReelsRoute();

      // Handle Home feed placeholder
      this.handleHomeFeed();

      // Filter suggested posts if enabled
      this.filterSuggestedPosts();
    }

    handleReelsRoute() {
      const isReels = this.route === 'reels';
      const shouldBlock = this.active && this.config.blockReels && isReels;

      if (shouldBlock) {
        // Pause any playing media
        const videoEl = document.querySelector('video');
        if (videoEl && !videoEl.paused) {
          try {
            videoEl.pause();
          } catch (e) {
            // Ignore restricted error
          }
        }

        if (!this.reelsOverlayEl) {
          this.renderReelsOverlay();
        }
      } else {
        if (this.reelsOverlayEl) {
          this.reelsOverlayEl.remove();
          this.reelsOverlayEl = null;
        }
      }
    }

    renderReelsOverlay() {
      if (document.getElementById('focus-fb-reels-overlay')) return;

      const overlay = document.createElement('div');
      overlay.id = 'focus-fb-reels-overlay';
      overlay.className = 'focus-fb-reels-overlay';

      overlay.innerHTML = `
        <div class="focus-fb-card" role="dialog" aria-labelledby="focus-reels-title">
          <div class="focus-fb-badge warning">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            Reels Blocked
          </div>
          <h2 id="focus-reels-title" class="focus-fb-title">Reels Are Blocked</h2>
          <p class="focus-fb-desc">
            Focus Mode blocks addictive short video reels to protect your time and concentration.
          </p>
          <div class="focus-fb-links" style="margin-bottom: 20px;">
            <a href="/" class="focus-fb-button primary">Back to Home</a>
            <a href="/groups/" class="focus-fb-button secondary">Open Groups</a>
            <a href="/messages/" class="focus-fb-button secondary">Open Messages</a>
          </div>
          <form class="focus-fb-search-form" id="focus-reels-search-form">
            <input type="text" class="focus-fb-search-input" placeholder="Search Facebook instead..." aria-label="Search Facebook" />
            <button type="submit" class="focus-fb-button primary">Search</button>
          </form>
        </div>
      `;

      const form = overlay.querySelector('#focus-reels-search-form');
      const input = overlay.querySelector('.focus-fb-search-input');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = input.value.trim();
        if (query) {
          window.location.href = `/search/top/?q=${encodeURIComponent(query)}`;
        }
      });

      const parent = document.body || document.documentElement;
      parent.appendChild(overlay);
      this.reelsOverlayEl = overlay;
      setTimeout(() => input.focus(), 100);
    }

    handleHomeFeed() {
      const isHome = this.route === 'home';
      const shouldShowCard = this.active && (this.config.hideFeed || this.config.searchFirst) && isHome;

      if (!shouldShowCard) {
        if (this.searchCardEl) {
          this.searchCardEl.remove();
          this.searchCardEl = null;
        }
        return;
      }

      this.renderHomeFocusCard();
    }

    renderHomeFocusCard() {
      if (document.getElementById('focus-fb-home-card')) return;

      // Find main content container
      const mainContainer = document.querySelector('div[role="main"]') ||
                            document.querySelector('div[role="feed"]')?.parentElement;

      if (!mainContainer) return;

      const card = document.createElement('div');
      card.id = 'focus-fb-home-card';
      card.className = 'focus-fb-card';
      card.setAttribute('role', 'region');
      card.setAttribute('aria-label', 'Focus Mode Facebook Hub');

      card.innerHTML = `
        <div class="focus-fb-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>
          Search-First Mode Active
        </div>
        <h1 class="focus-fb-title">What are you looking for today?</h1>
        <p class="focus-fb-desc">
          The algorithmic news feed is hidden. You can search intentionally or navigate directly to your communities and messages.
        </p>
        <form class="focus-fb-search-form" id="focus-fb-home-search-form">
          <input type="text" class="focus-fb-search-input" id="focus-fb-home-search-input" placeholder="Search people, groups, or pages..." aria-label="Search Facebook" />
          <button type="submit" class="focus-fb-button primary">Search</button>
        </form>
        <div class="focus-fb-links">
          <a href="/groups/" class="focus-fb-button secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Groups
          </a>
          <a href="/pages/" class="focus-fb-button secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            Pages
          </a>
          <a href="/messages/" class="focus-fb-button secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Messages
          </a>
        </div>
      `;

      const form = card.querySelector('#focus-fb-home-search-form');
      const input = card.querySelector('#focus-fb-home-search-input');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = input.value.trim();
        if (query) {
          window.location.href = `/search/top/?q=${encodeURIComponent(query)}`;
        }
      });

      mainContainer.prepend(card);
      this.searchCardEl = card;

      // Auto-focus search input if searchFirst is enabled
      if (this.config.searchFirst) {
        setTimeout(() => {
          const fbSearchInput = document.querySelector('input[type="search"]') ||
                                document.querySelector('input[aria-label*="Search" i]') ||
                                input;
          if (fbSearchInput) fbSearchInput.focus();
        }, 150);
      }
    }

    /**
     * Identify and tag algorithmic suggested/sponsored posts in feed
     */
    filterSuggestedPosts() {
      if (!this.active || !this.config.hideSuggested) return;

      const articles = document.querySelectorAll('div[role="article"], div[data-pagelet^="FeedUnit"]');
      for (const article of articles) {
        if (article.dataset.focusSuggestedPost) continue;

        const textContent = article.textContent?.toLowerCase() || '';
        const isSuggested = SUGGESTED_MARKERS.some((marker) => textContent.includes(marker));

        if (isSuggested) {
          article.dataset.focusSuggestedPost = 'true';
        }
      }
    }

    applyDomEnhancements() {
      const currentRoute = classifyRoute();
      if (currentRoute !== this.route) {
        this.route = currentRoute;
        this.syncState();
      }

      if (this.route === 'home' && this.active && (this.config.hideFeed || this.config.searchFirst)) {
        if (!document.getElementById('focus-fb-home-card')) {
          this.renderHomeFocusCard();
        }
      }

      if (this.route === 'reels' && this.active && this.config.blockReels) {
        const videoEl = document.querySelector('video');
        if (videoEl && !videoEl.paused) {
          try { videoEl.pause(); } catch (e) {}
        }
        if (!document.getElementById('focus-fb-reels-overlay')) {
          this.renderReelsOverlay();
        }
      }

      this.filterSuggestedPosts();
    }
  }

  const adapter = new FacebookAdapter();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => adapter.init());
  } else {
    adapter.init();
  }

  // Export for testing
  window.__FocusModeFacebook = {
    classifyRoute,
    SUGGESTED_MARKERS,
    adapter
  };
})();

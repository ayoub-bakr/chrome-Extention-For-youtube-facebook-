/**
 * Focus Mode - Shared Content Script Utilities
 * Provides resilient settings management, SPA route tracking, DOM mutation coordination,
 * and declarative document attributes.
 */

(function () {
  'use strict';

  // Prevent multiple initializations in the same frame
  if (window.__FocusModeShared) return;

  const DEFAULT_SETTINGS = {
    version: 1,
    globalEnabled: true,
    pausedUntil: 0,
    sites: {
      youtube: {
        enabled: true,
        blockShorts: true,
        hideFeed: true,
        hideSuggested: true,
        hideSidebar: true,
        searchFirst: true
      },
      facebook: {
        enabled: true,
        blockReels: true,
        hideFeed: true,
        hideSuggested: true,
        hideSidebar: false,
        searchFirst: true
      }
    }
  };

  class FocusModeCore {
    constructor() {
      this.settings = { ...DEFAULT_SETTINGS };
      this.routeChangeCallbacks = new Set();
      this.settingsChangeCallbacks = new Set();
      this.currentUrl = window.location.href;
      this.initialized = false;
    }

    /**
     * Get preferred storage (sync with fallback to local)
     */
    getStorage() {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          return chrome.storage.sync || chrome.storage.local;
        }
      } catch (e) {
        console.warn('[Focus Mode] chrome.storage access warning:', e);
      }
      return null;
    }

    /**
     * Load settings from storage
     */
    async loadSettings() {
      const storage = this.getStorage();
      if (!storage) return this.settings;

      return new Promise((resolve) => {
        storage.get(null, (items) => {
          if (chrome.runtime.lastError) {
            console.warn('[Focus Mode] Error reading storage:', chrome.runtime.lastError);
            resolve(this.settings);
            return;
          }
          if (items && Object.keys(items).length > 0) {
            this.settings = {
              ...DEFAULT_SETTINGS,
              ...items,
              sites: {
                youtube: { ...DEFAULT_SETTINGS.sites.youtube, ...(items.sites?.youtube || {}) },
                facebook: { ...DEFAULT_SETTINGS.sites.facebook, ...(items.sites?.facebook || {}) }
              }
            };
          }
          resolve(this.settings);
        });
      });
    }

    /**
     * Check if filtering is temporarily paused
     */
    isPaused() {
      if (!this.settings || !this.settings.pausedUntil) return false;
      return Date.now() < this.settings.pausedUntil;
    }

    /**
     * Check if filtering should be active for a specific site
     */
    isSiteActive(siteName) {
      if (!this.settings.globalEnabled) return false;
      if (this.isPaused()) return false;
      const siteConfig = this.settings.sites?.[siteName];
      return Boolean(siteConfig && siteConfig.enabled);
    }

    /**
     * Get configuration for a specific site
     */
    getSiteConfig(siteName) {
      const active = this.isSiteActive(siteName);
      const raw = this.settings.sites?.[siteName] || {};
      return {
        active,
        ...raw
      };
    }

    /**
     * Sync root dataset attributes to drive declarative CSS hiding
     */
    updateDocumentAttributes(siteName, routeName, extraAttrs = {}) {
      const doc = document.documentElement;
      if (!doc) return;

      const active = this.isSiteActive(siteName);
      doc.dataset.focusActive = String(active);
      doc.dataset.focusSite = siteName;
      doc.dataset.focusRoute = routeName || 'unknown';

      const siteConfig = this.settings.sites?.[siteName] || {};
      for (const [key, value] of Object.entries(siteConfig)) {
        if (typeof value === 'boolean') {
          // If extension or site is disabled/paused, feature flags should be disabled
          const effectiveVal = active ? String(value) : 'false';
          doc.dataset[`focus${key.charAt(0).toUpperCase() + key.slice(1)}`] = effectiveVal;
        }
      }

      for (const [key, value] of Object.entries(extraAttrs)) {
        doc.dataset[key] = String(value);
      }
    }

    /**
     * Initialize listeners for storage and SPA navigation
     */
    init() {
      if (this.initialized) return;
      this.initialized = true;

      // Storage changes
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
          this.loadSettings().then(() => {
            this.settingsChangeCallbacks.forEach((cb) => cb(this.settings));
          });
        });
      }

      // History navigation hooking for SPAs
      this.setupSpaNavigationWatcher();
    }

    onSettingsChange(callback) {
      this.settingsChangeCallbacks.add(callback);
      return () => this.settingsChangeCallbacks.delete(callback);
    }

    onRouteChange(callback) {
      this.routeChangeCallbacks.add(callback);
      return () => this.routeChangeCallbacks.delete(callback);
    }

    setupSpaNavigationWatcher() {
      const notifyRouteChange = () => {
        const newUrl = window.location.href;
        if (newUrl !== this.currentUrl) {
          const oldUrl = this.currentUrl;
          this.currentUrl = newUrl;
          this.routeChangeCallbacks.forEach((cb) => cb(newUrl, oldUrl));
        }
      };

      // Monkeypatch pushState and replaceState
      const originalPushState = history.pushState;
      if (originalPushState) {
        history.pushState = function (...args) {
          const result = originalPushState.apply(this, args);
          window.dispatchEvent(new Event('focus:navigation'));
          return result;
        };
      }

      const originalReplaceState = history.replaceState;
      if (originalReplaceState) {
        history.replaceState = function (...args) {
          const result = originalReplaceState.apply(this, args);
          window.dispatchEvent(new Event('focus:navigation'));
          return result;
        };
      }

      window.addEventListener('popstate', notifyRouteChange);
      window.addEventListener('hashchange', notifyRouteChange);
      window.addEventListener('focus:navigation', notifyRouteChange);

      // YouTube custom events
      window.addEventListener('yt-navigate-start', notifyRouteChange);
      window.addEventListener('yt-navigate-finish', notifyRouteChange);
      window.addEventListener('yt-page-data-updated', notifyRouteChange);

      // Lightweight polling fallback for SPAs that mutate history internally
      setInterval(notifyRouteChange, 300);
    }

    /**
     * Efficient DOM observer helper with RAF throttling
     */
    createBatchObserver(callback, root = document.documentElement) {
      let scheduled = false;
      const debouncedCallback = () => {
        scheduled = false;
        callback();
      };

      const observer = new MutationObserver(() => {
        if (!scheduled) {
          scheduled = true;
          requestAnimationFrame(debouncedCallback);
        }
      });

      if (root) {
        observer.observe(root, {
          childList: true,
          subtree: true
        });
      }

      return observer;
    }
  }

  window.__FocusModeShared = new FocusModeCore();
  window.__FocusModeShared.init();
})();

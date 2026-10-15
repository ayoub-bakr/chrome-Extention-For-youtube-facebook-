import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

test('Declarative Document Attributes and State Synchronization', async (t) => {
  const { document, window } = parseHTML('<!DOCTYPE html><html><head></head><body></body></html>');

  const defaultSettings = {
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

  function updateDocumentAttributes(doc, settings, siteName, routeName) {
    const isPaused = Boolean(settings.pausedUntil && Date.now() < settings.pausedUntil);
    const siteConfig = settings.sites?.[siteName] || {};
    const active = settings.globalEnabled && !isPaused && Boolean(siteConfig.enabled);

    doc.dataset.focusActive = String(active);
    doc.dataset.focusSite = siteName;
    doc.dataset.focusRoute = routeName || 'unknown';

    for (const [key, value] of Object.entries(siteConfig)) {
      if (typeof value === 'boolean') {
        const effectiveVal = active ? String(value) : 'false';
        doc.dataset[`focus${key.charAt(0).toUpperCase() + key.slice(1)}`] = effectiveVal;
      }
    }
  }

  const docEl = document.documentElement;

  await t.test('Applies active YouTube attributes on Home route', () => {
    updateDocumentAttributes(docEl, defaultSettings, 'youtube', 'home');

    assert.equal(docEl.dataset.focusActive, 'true');
    assert.equal(docEl.dataset.focusSite, 'youtube');
    assert.equal(docEl.dataset.focusRoute, 'home');
    assert.equal(docEl.dataset.focusBlockShorts, 'true');
    assert.equal(docEl.dataset.focusHideFeed, 'true');
    assert.equal(docEl.dataset.focusHideSidebar, 'true');
    assert.equal(docEl.dataset.focusHideSuggested, 'true');
    assert.equal(docEl.dataset.focusSearchFirst, 'true');
  });

  await t.test('Applies active Facebook attributes on Home route', () => {
    updateDocumentAttributes(docEl, defaultSettings, 'facebook', 'home');

    assert.equal(docEl.dataset.focusActive, 'true');
    assert.equal(docEl.dataset.focusSite, 'facebook');
    assert.equal(docEl.dataset.focusRoute, 'home');
    assert.equal(docEl.dataset.focusBlockReels, 'true');
    assert.equal(docEl.dataset.focusHideFeed, 'true');
    assert.equal(docEl.dataset.focusHideSidebar, 'false'); // Always false on Facebook!
    assert.equal(docEl.dataset.focusHideSuggested, 'true');
    assert.equal(docEl.dataset.focusSearchFirst, 'true');
  });

  await t.test('Disabling site deactivates all flags declaratively', () => {
    const disabledYoutube = JSON.parse(JSON.stringify(defaultSettings));
    disabledYoutube.sites.youtube.enabled = false;

    updateDocumentAttributes(docEl, disabledYoutube, 'youtube', 'home');

    assert.equal(docEl.dataset.focusActive, 'false');
    assert.equal(docEl.dataset.focusBlockShorts, 'false');
    assert.equal(docEl.dataset.focusHideFeed, 'false');
    assert.equal(docEl.dataset.focusHideSidebar, 'false');
  });

  await t.test('Global disable deactivates all flags declaratively', () => {
    const globalOff = { ...defaultSettings, globalEnabled: false };

    updateDocumentAttributes(docEl, globalOff, 'youtube', 'home');

    assert.equal(docEl.dataset.focusActive, 'false');
    assert.equal(docEl.dataset.focusBlockShorts, 'false');
    assert.equal(docEl.dataset.focusHideFeed, 'false');
  });

  await t.test('Pause timer deactivates flags until expiration', () => {
    const futurePause = { ...defaultSettings, pausedUntil: Date.now() + 15 * 60 * 1000 };

    updateDocumentAttributes(docEl, futurePause, 'youtube', 'watch');

    assert.equal(docEl.dataset.focusActive, 'false');
    assert.equal(docEl.dataset.focusHideSidebar, 'false');

    // After pause expires
    const expiredPause = { ...defaultSettings, pausedUntil: Date.now() - 1000 };
    updateDocumentAttributes(docEl, expiredPause, 'youtube', 'watch');

    assert.equal(docEl.dataset.focusActive, 'true');
    assert.equal(docEl.dataset.focusHideSidebar, 'true');
  });
});

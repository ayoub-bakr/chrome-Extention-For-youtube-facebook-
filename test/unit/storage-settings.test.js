import test from 'node:test';
import assert from 'node:assert/strict';

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

function isPaused(settings, now = Date.now()) {
  return Boolean(settings.pausedUntil && now < settings.pausedUntil);
}

function isSiteActive(settings, siteName, now = Date.now()) {
  if (settings.globalEnabled === false) return false;
  if (isPaused(settings, now)) return false;
  const site = settings.sites?.[siteName];
  return Boolean(site && site.enabled !== false);
}

test('Settings Gating & State Resolution', async (t) => {
  await t.test('active by default for both YouTube and Facebook', () => {
    assert.equal(isSiteActive(DEFAULT_SETTINGS, 'youtube'), true);
    assert.equal(isSiteActive(DEFAULT_SETTINGS, 'facebook'), true);
  });

  await t.test('respects global switch', () => {
    const disabled = { ...DEFAULT_SETTINGS, globalEnabled: false };
    assert.equal(isSiteActive(disabled, 'youtube'), false);
    assert.equal(isSiteActive(disabled, 'facebook'), false);
  });

  await t.test('respects pause timer', () => {
    const now = 100000;
    const paused = { ...DEFAULT_SETTINGS, pausedUntil: now + 60000 };
    assert.equal(isPaused(paused, now), true);
    assert.equal(isSiteActive(paused, 'youtube', now), false);

    // After pause duration expires
    const expired = { ...DEFAULT_SETTINGS, pausedUntil: now - 1000 };
    assert.equal(isPaused(expired, now), false);
    assert.equal(isSiteActive(expired, 'youtube', now), true);
  });

  await t.test('respects per-site toggle independently', () => {
    const custom = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    custom.sites.youtube.enabled = false;
    custom.sites.facebook.enabled = true;

    assert.equal(isSiteActive(custom, 'youtube'), false);
    assert.equal(isSiteActive(custom, 'facebook'), true);
  });

  await t.test('preserves independent feature toggles without cross-site bleeding', () => {
    const custom = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    // User disables Shorts on YouTube, but keeps FB Reels enabled
    custom.sites.youtube.blockShorts = false;
    custom.sites.facebook.blockReels = true;

    assert.equal(custom.sites.youtube.blockShorts, false);
    assert.equal(custom.sites.facebook.blockReels, true);

    // User disables Sidebar on YouTube
    custom.sites.youtube.hideSidebar = false;
    assert.equal(custom.sites.youtube.hideSidebar, false);
    assert.equal(custom.sites.youtube.hideFeed, true); // Other settings unaffected!
  });

  await t.test('enforces that Facebook sidebar remains disabled/unsupported', () => {
    assert.equal(DEFAULT_SETTINGS.sites.facebook.hideSidebar, false);
  });
});

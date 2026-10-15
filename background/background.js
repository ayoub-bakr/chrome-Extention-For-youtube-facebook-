/**
 * Focus Mode Background Service Worker
 * Manages default settings initialization, badge status, and pause timers.
 */

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
      hideSidebar: false, // Unsupported on FB: sidebars contain core navigation & messages
      searchFirst: true
    }
  }
};

const PAUSE_ALARM_NAME = 'focus-mode-pause-alarm';

function getStorageArea() {
  return chrome.storage.sync || chrome.storage.local;
}

// Initialize default settings on install
chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    const storage = getStorageArea();
    const existing = await storage.get(null);
    if (!existing || Object.keys(existing).length === 0 || !existing.sites) {
      await storage.set(DEFAULT_SETTINGS);
    } else {
      // Merge in any newly added defaults while preserving user choices
      const merged = {
        ...DEFAULT_SETTINGS,
        ...existing,
        sites: {
          youtube: { ...DEFAULT_SETTINGS.sites.youtube, ...(existing.sites?.youtube || {}) },
          facebook: { ...DEFAULT_SETTINGS.sites.facebook, ...(existing.sites?.facebook || {}) }
        }
      };
      await storage.set(merged);
    }
    await updateBadge();
  } catch (err) {
    console.error('[Focus Mode] Failed to initialize settings:', err);
  }
});

// Update badge display based on current state
async function updateBadge() {
  try {
    const storage = getStorageArea();
    const settings = await storage.get(['globalEnabled', 'pausedUntil']);
    const now = Date.now();

    if (settings.globalEnabled === false) {
      await chrome.action.setBadgeText({ text: 'OFF' });
      await chrome.action.setBadgeBackgroundColor({ color: '#6B7280' }); // slate gray
      return;
    }

    if (settings.pausedUntil && settings.pausedUntil > now) {
      await chrome.action.setBadgeText({ text: 'PAUS' });
      await chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' }); // amber warning
      return;
    }

    // Active
    await chrome.action.setBadgeText({ text: '' });
  } catch (err) {
    console.error('[Focus Mode] Failed to update badge:', err);
  }
}

// Listen to storage changes to update badge and schedule pause alarm
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (changes.globalEnabled || changes.pausedUntil) {
    await updateBadge();
  }

  if (changes.pausedUntil) {
    const newPausedUntil = changes.pausedUntil.newValue || 0;
    const now = Date.now();
    await chrome.alarms.clear(PAUSE_ALARM_NAME);
    if (newPausedUntil > now) {
      chrome.alarms.create(PAUSE_ALARM_NAME, {
        when: newPausedUntil
      });
    }
  }
});

// Alarm listener for pause expiration
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === PAUSE_ALARM_NAME) {
    try {
      const storage = getStorageArea();
      await storage.set({ pausedUntil: 0 });
      await updateBadge();
    } catch (err) {
      console.error('[Focus Mode] Error resetting pause alarm:', err);
    }
  }
});

// Initial badge update on startup
updateBadge();

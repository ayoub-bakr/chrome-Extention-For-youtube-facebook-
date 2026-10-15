/**
 * Focus Mode - Popup Controller
 * Manages independent toggles, pause timers, tab switching, and per-site feature matrices.
 */

'use strict';

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

let currentSettings = { ...DEFAULT_SETTINGS };
let currentSite = 'youtube';
let countdownInterval = null;

function getStorage() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    return chrome.storage.sync || chrome.storage.local;
  }
  return null;
}

// DOM Elements
const globalToggle = document.getElementById('global-toggle');
const globalStatusText = document.getElementById('global-status-text');
const siteToggle = document.getElementById('site-toggle');
const currentSiteTitle = document.getElementById('current-site-title');
const currentSiteDesc = document.getElementById('current-site-desc');
const tabYouTube = document.getElementById('tab-youtube');
const tabFacebook = document.getElementById('tab-facebook');
const dotYouTube = document.getElementById('dot-youtube');
const dotFacebook = document.getElementById('dot-facebook');

// Feature Toggles
const toggleShorts = document.getElementById('toggle-shorts');
const toggleFeed = document.getElementById('toggle-feed');
const toggleSuggested = document.getElementById('toggle-suggested');
const toggleSidebar = document.getElementById('toggle-sidebar');
const toggleSearchFirst = document.getElementById('toggle-search-first');

const labelShorts = document.getElementById('label-shorts');
const descShorts = document.getElementById('desc-shorts');
const descFeed = document.getElementById('desc-feed');
const descSuggested = document.getElementById('desc-suggested');
const descSidebar = document.getElementById('desc-sidebar');
const descSearch = document.getElementById('desc-search');

const badgeSuggested = document.getElementById('badge-suggested');
const badgeSidebar = document.getElementById('badge-sidebar');
const supportNotice = document.getElementById('support-notice');
const supportNoticeText = document.getElementById('support-notice-text');

// Pause UI
const pauseButtonGroup = document.getElementById('pause-button-group');
const pauseTimeRemaining = document.getElementById('pause-time-remaining');
const resumeBtn = document.getElementById('resume-btn');
const activeTabIndicator = document.getElementById('active-tab-indicator');

/**
 * Initialize popup
 */
async function initPopup() {
  await loadSettings();
  await detectActiveTabSite();
  setupEventListeners();
  render();
  startCountdownTicker();

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(async () => {
      await loadSettings();
      render();
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPopup);
} else {
  initPopup();
}

/**
 * Load settings from storage
 */
async function loadSettings() {
  const storage = getStorage();
  if (!storage) return;

  return new Promise((resolve) => {
    storage.get(null, (items) => {
      if (items && Object.keys(items).length > 0) {
        currentSettings = {
          ...DEFAULT_SETTINGS,
          ...items,
          sites: {
            youtube: { ...DEFAULT_SETTINGS.sites.youtube, ...(items.sites?.youtube || {}) },
            facebook: { ...DEFAULT_SETTINGS.sites.facebook, ...(items.sites?.facebook || {}) }
          }
        };
      }
      resolve();
    });
  });
}

/**
 * Save current settings to storage
 */
async function saveSettings() {
  const storage = getStorage();
  if (!storage) return;

  try {
    await storage.set(currentSettings);
  } catch (err) {
    console.error('[Focus Mode] Failed to save settings:', err);
  }
}

/**
 * Detect current active tab URL and set default tab accordingly
 */
async function detectActiveTabSite() {
  if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) return;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      if (tab.url.includes('facebook.com')) {
        currentSite = 'facebook';
      } else if (tab.url.includes('youtube.com')) {
        currentSite = 'youtube';
      }
    }
  } catch (err) {
    console.warn('[Focus Mode] Could not detect active tab:', err);
  }
}

/**
 * Setup UI event listeners
 */
function setupEventListeners() {
  // Global Toggle
  globalToggle.addEventListener('change', (e) => {
    currentSettings.globalEnabled = e.target.checked;
    saveSettings();
    render();
  });

  // Site Master Toggle
  siteToggle.addEventListener('change', (e) => {
    currentSettings.sites[currentSite].enabled = e.target.checked;
    saveSettings();
    render();
  });

  // Feature Toggles
  toggleShorts.addEventListener('change', (e) => {
    if (currentSite === 'youtube') {
      currentSettings.sites.youtube.blockShorts = e.target.checked;
    } else {
      currentSettings.sites.facebook.blockReels = e.target.checked;
    }
    saveSettings();
  });

  toggleFeed.addEventListener('change', (e) => {
    currentSettings.sites[currentSite].hideFeed = e.target.checked;
    saveSettings();
  });

  toggleSuggested.addEventListener('change', (e) => {
    currentSettings.sites[currentSite].hideSuggested = e.target.checked;
    saveSettings();
  });

  toggleSidebar.addEventListener('change', (e) => {
    if (currentSite === 'youtube') {
      currentSettings.sites.youtube.hideSidebar = e.target.checked;
      saveSettings();
    }
  });

  toggleSearchFirst.addEventListener('change', (e) => {
    currentSettings.sites[currentSite].searchFirst = e.target.checked;
    saveSettings();
  });

  // Site Tabs
  tabYouTube.addEventListener('click', () => {
    currentSite = 'youtube';
    render();
  });

  tabFacebook.addEventListener('click', () => {
    currentSite = 'facebook';
    render();
  });

  // Pause Duration Buttons
  document.querySelectorAll('.pause-btn[data-minutes]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const minutes = parseInt(btn.dataset.minutes, 10);
      currentSettings.pausedUntil = Date.now() + minutes * 60 * 1000;
      saveSettings();
      render();
    });
  });

  // Resume Button
  resumeBtn.addEventListener('click', () => {
    currentSettings.pausedUntil = 0;
    saveSettings();
    render();
  });
}

/**
 * Render the entire popup UI according to currentSettings and currentSite
 */
function render() {
  const isGlobalEnabled = currentSettings.globalEnabled !== false;
  const isPaused = currentSettings.pausedUntil && Date.now() < currentSettings.pausedUntil;
  const siteConfig = currentSettings.sites[currentSite] || {};
  const isSiteEnabled = siteConfig.enabled !== false;

  // Header status
  globalToggle.checked = isGlobalEnabled;
  if (!isGlobalEnabled) {
    globalStatusText.textContent = 'Disabled Globally';
    globalStatusText.className = 'brand-subtitle disabled';
  } else if (isPaused) {
    globalStatusText.textContent = 'Filtering Paused';
    globalStatusText.className = 'brand-subtitle paused';
  } else {
    globalStatusText.textContent = 'Active & Protecting';
    globalStatusText.className = 'brand-subtitle';
  }

  // Pause UI
  if (isPaused) {
    resumeBtn.style.display = 'inline-block';
    updatePauseCountdown();
  } else {
    resumeBtn.style.display = 'none';
    pauseTimeRemaining.textContent = '';
  }

  // Tab buttons styling
  tabYouTube.classList.toggle('active', currentSite === 'youtube');
  tabFacebook.classList.toggle('active', currentSite === 'facebook');
  tabYouTube.setAttribute('aria-selected', String(currentSite === 'youtube'));
  tabFacebook.setAttribute('aria-selected', String(currentSite === 'facebook'));

  dotYouTube.classList.toggle('disabled', !currentSettings.sites.youtube.enabled);
  dotFacebook.classList.toggle('disabled', !currentSettings.sites.facebook.enabled);

  // Site Master Bar
  siteToggle.checked = isSiteEnabled;
  const siteMasterBar = document.querySelector('.site-master-bar');
  siteMasterBar.classList.toggle('site-disabled', !isSiteEnabled);

  if (currentSite === 'youtube') {
    currentSiteTitle.textContent = 'YouTube Protection';
    currentSiteDesc.textContent = 'Applies on youtube.com';
  } else {
    currentSiteTitle.textContent = 'Facebook Protection';
    currentSiteDesc.textContent = 'Applies on facebook.com';
  }

  // Feature Toggles state
  const togglesContainer = document.getElementById('toggles-list');
  const disabledState = !isGlobalEnabled || !isSiteEnabled;
  togglesContainer.style.opacity = disabledState ? '0.5' : '1';
  togglesContainer.style.pointerEvents = disabledState ? 'none' : 'auto';

  if (currentSite === 'youtube') {
    // YouTube Specifics
    labelShorts.textContent = 'Block Shorts';
    descShorts.textContent = 'Hides Shorts shelves, navigation badges, and direct links.';
    toggleShorts.checked = siteConfig.blockShorts !== false;

    descFeed.textContent = 'Removes home recommendation grid; preserves search and subscriptions.';
    toggleFeed.checked = siteConfig.hideFeed !== false;

    badgeSuggested.style.display = 'none';
    descSuggested.textContent = 'Hides search recommendation shelves and video end-screens.';
    toggleSuggested.checked = siteConfig.hideSuggested !== false;

    // Sidebar on YouTube is fully supported
    badgeSidebar.style.display = 'none';
    toggleSidebar.disabled = false;
    toggleSidebar.checked = siteConfig.hideSidebar !== false;
    descSidebar.textContent = 'Hides related video sidebar on watch pages.';
    document.getElementById('item-hide-sidebar').classList.remove('disabled-item');

    descSearch.textContent = 'Prompts intentional search and focuses search bar on Home.';
    toggleSearchFirst.checked = siteConfig.searchFirst !== false;

    supportNotice.style.display = 'none';
  } else {
    // Facebook Specifics
    labelShorts.textContent = 'Block Reels';
    descShorts.textContent = 'Hides Reels carousels, navigation entries, and direct reel URLs.';
    toggleShorts.checked = siteConfig.blockReels !== false;

    descFeed.textContent = 'Hides algorithmic news feed; preserves Groups, Pages, and Messages.';
    toggleFeed.checked = siteConfig.hideFeed !== false;

    badgeSuggested.style.display = 'inline-block';
    badgeSuggested.textContent = 'Locale-based';
    descSuggested.textContent = 'Detects English and localized "Suggested for you" and sponsored posts.';
    toggleSuggested.checked = siteConfig.hideSuggested !== false;

    // Sidebar on Facebook is UNSUPPORTED because sidebars contain navigation/messages
    badgeSidebar.style.display = 'inline-block';
    badgeSidebar.className = 'badge unsupported';
    badgeSidebar.textContent = 'Unsupported';
    toggleSidebar.checked = false;
    toggleSidebar.disabled = true;
    descSidebar.textContent = 'Facebook sidebars contain navigation and chat, not algorithmic suggestions.';
    document.getElementById('item-hide-sidebar').classList.add('disabled-item');

    descSearch.textContent = 'Focuses Facebook search bar and displays intentional hub on Home.';
    toggleSearchFirst.checked = siteConfig.searchFirst !== false;

    supportNotice.style.display = 'flex';
    supportNoticeText.textContent =
      'Facebook sidebar filtering is disabled to preserve core navigation and messaging. Suggested post detection relies on standard layout headers.';
  }

  // Footer status
  if (!isGlobalEnabled) {
    activeTabIndicator.textContent = 'Globally OFF';
    activeTabIndicator.style.color = '#94a3b8';
  } else if (isPaused) {
    activeTabIndicator.textContent = 'Paused';
    activeTabIndicator.style.color = '#f59e0b';
  } else if (!isSiteEnabled) {
    activeTabIndicator.textContent = `${currentSite === 'youtube' ? 'YouTube' : 'Facebook'} OFF`;
    activeTabIndicator.style.color = '#94a3b8';
  } else {
    activeTabIndicator.textContent = 'Active';
    activeTabIndicator.style.color = '#10b981';
  }
}

/**
 * Ticker to refresh remaining pause time every second
 */
function startCountdownTicker() {
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    if (currentSettings.pausedUntil && currentSettings.pausedUntil > Date.now()) {
      updatePauseCountdown();
    } else if (currentSettings.pausedUntil && currentSettings.pausedUntil <= Date.now()) {
      currentSettings.pausedUntil = 0;
      saveSettings();
      render();
    }
  }, 1000);
}

function updatePauseCountdown() {
  const diffMs = currentSettings.pausedUntil - Date.now();
  if (diffMs <= 0) {
    pauseTimeRemaining.textContent = '';
    return;
  }
  const mins = Math.floor(diffMs / 60000);
  const secs = Math.floor((diffMs % 60000) / 1000);
  pauseTimeRemaining.textContent = `(${mins}m ${secs < 10 ? '0' : ''}${secs}s remaining)`;
}

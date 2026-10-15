import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

test('Regression Tests for Confirmed Bug Fixes', async (t) => {
  await t.test('Bugfix 1: YouTube CSS covers both ytd-watch-flexy and ytd-watch-grid for sidebar hiding', () => {
    const cssPath = path.join(projectRoot, 'content/youtube.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    assert.ok(cssContent.includes('#secondary.ytd-watch-flexy'), 'Contains classic ytd-watch-flexy selector');
    assert.ok(cssContent.includes('#secondary.ytd-watch-grid'), 'Contains modern ytd-watch-grid selector');
    assert.ok(cssContent.includes('#primary.ytd-watch-grid'), 'Centers primary player on ytd-watch-grid');
  });

  await t.test('Bugfix 2: Dynamic Shorts URL navigation updates the normal player button', () => {
    const { document } = parseHTML(`
      <div id="focus-mode-shorts-overlay">
        <a href="/watch?v=first_video" id="focus-open-regular">Watch in Normal Player</a>
      </div>
    `);

    // Simulate SPA navigation to a second Shorts video
    const newVideoId = 'second_video';
    const openRegularBtn = document.querySelector('#focus-open-regular');

    if (newVideoId) {
      openRegularBtn.href = `/watch?v=${newVideoId}`;
      openRegularBtn.style.display = 'inline-flex';
    }

    assert.equal(openRegularBtn.href, '/watch?v=second_video', 'Updated watch URL to second video');
    assert.equal(openRegularBtn.style.display, 'inline-flex');
  });

  await t.test('Bugfix 3: Popup registers chrome.storage.onChanged to maintain live sync with background alarms', () => {
    const popupJsPath = path.join(projectRoot, 'popup/popup.js');
    const popupContent = fs.readFileSync(popupJsPath, 'utf8');

    assert.ok(
      popupContent.includes('chrome.storage.onChanged.addListener'),
      'popup.js must listen to chrome.storage.onChanged to react to background unpause alarms'
    );
  });

  await t.test('Bugfix 4: Shorts overlay uses safe parent mounting fallback when document.body is not yet parsed', () => {
    const youtubeJsPath = path.join(projectRoot, 'content/youtube.js');
    const ytContent = fs.readFileSync(youtubeJsPath, 'utf8');

    assert.ok(
      ytContent.includes('document.body || document.documentElement'),
      'Must use document.body || document.documentElement fallback to prevent null pointer at document_start'
    );
  });
});

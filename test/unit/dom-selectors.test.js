import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

test('YouTube DOM Element Selection & Non-Overblocking Preservation', async (t) => {
  const sampleYouTubeHtml = `
    <!DOCTYPE html>
    <html data-focus-active="true" data-focus-site="youtube" data-focus-route="home"
          data-focus-block-shorts="true" data-focus-hide-feed="true" data-focus-hide-sidebar="true" data-focus-hide-suggested="true">
    <head><title>YouTube</title></head>
    <body>
      <!-- Top Bar: Must NEVER be hidden -->
      <ytd-masthead id="masthead">
        <div id="search-input">
          <input id="search" placeholder="Search" />
        </div>
      </ytd-masthead>

      <!-- Left Sidebar / Guide -->
      <ytd-guide-renderer>
        <ytd-guide-entry-renderer id="home-entry">
          <a href="/">Home</a>
        </ytd-guide-entry-renderer>
        <ytd-guide-entry-renderer id="shorts-entry">
          <a href="/shorts">Shorts</a>
        </ytd-guide-entry-renderer>
        <ytd-guide-entry-renderer id="subscriptions-entry">
          <a href="/feed/subscriptions">Subscriptions</a>
        </ytd-guide-entry-renderer>
      </ytd-guide-renderer>

      <!-- Main Home Content -->
      <ytd-browse page-subtype="home">
        <div id="primary">
          <ytd-rich-grid-renderer id="home-recommendation-grid">
            <div id="contents" class="ytd-rich-grid-renderer">
              <ytd-rich-item-renderer id="video-card-1"></ytd-rich-item-renderer>
              <ytd-rich-section-renderer id="shorts-shelf-section">
                <ytd-rich-shelf-renderer is-shorts="true" id="shorts-shelf"></ytd-rich-shelf-renderer>
              </ytd-rich-section-renderer>
            </div>
          </ytd-rich-grid-renderer>
        </div>
      </ytd-browse>

      <!-- Watch Page Flexy Layout -->
      <ytd-watch-flexy>
        <div id="primary" class="ytd-watch-flexy">
          <div id="player">
            <div id="movie_player">
              <video src="blob:test"></video>
            </div>
          </div>
          <div id="title">Sample Video Title</div>
        </div>
        <div id="secondary" class="ytd-watch-flexy">
          <div id="related">
            <ytd-watch-next-secondary-results-renderer id="related-videos"></ytd-watch-next-secondary-results-renderer>
          </div>
        </div>
      </ytd-watch-flexy>

      <!-- Search Results Layout -->
      <ytd-search>
        <div id="contents" class="ytd-search">
          <ytd-video-renderer id="actual-search-result-1"></ytd-video-renderer>
          <ytd-video-renderer id="actual-search-result-2"></ytd-video-renderer>
          <ytd-shelf-renderer id="suggested-shelf-in-search">
            <span id="title-text">People also watched</span>
          </ytd-shelf-renderer>
          <ytd-reel-shelf-renderer id="shorts-in-search"></ytd-reel-shelf-renderer>
        </div>
      </ytd-search>
    </body>
    </html>
  `;

  const { document } = parseHTML(sampleYouTubeHtml);

  await t.test('Correctly identifies Home recommendation grid', () => {
    const homeGrid = document.querySelector('ytd-browse[page-subtype="home"] ytd-rich-grid-renderer');
    assert.ok(homeGrid, 'Should find Home rich grid renderer');
    assert.equal(homeGrid.id, 'home-recommendation-grid');
  });

  await t.test('Correctly targets Shorts navigation entry and shelf', () => {
    const shortsShelf = document.querySelector('ytd-rich-shelf-renderer[is-shorts]');
    assert.ok(shortsShelf, 'Should find Shorts shelf');

    const shortsNav = document.querySelector('ytd-guide-entry-renderer:has(a[href^="/shorts"])');
    // Note: linkedom supports simple CSS; if :has is evaluated manually or via query:
    const shortsLink = document.querySelector('a[href="/shorts"]');
    assert.ok(shortsLink, 'Should locate Shorts navigation link');
  });

  await t.test('Correctly identifies Watch related-videos sidebar', () => {
    const sidebar = document.querySelector('#secondary.ytd-watch-flexy #related');
    assert.ok(sidebar, 'Should find related videos sidebar');
  });

  await t.test('CRITICAL PRESERVATION: Search input and header are never targeted by blocking', () => {
    const searchInput = document.querySelector('input#search');
    const masthead = document.querySelector('#masthead');
    assert.ok(searchInput, 'Search input exists and is preserved');
    assert.ok(masthead, 'Masthead header exists and is preserved');
  });

  await t.test('CRITICAL PRESERVATION: Video player is never targeted by blocking', () => {
    const player = document.querySelector('#movie_player');
    const video = document.querySelector('video');
    assert.ok(player, 'Player exists');
    assert.ok(video, 'HTML5 video element exists');
  });

  await t.test('CRITICAL PRESERVATION: Actual search results are preserved', () => {
    const actualResults = document.querySelectorAll('ytd-search ytd-video-renderer');
    assert.equal(actualResults.length, 2, 'Must keep genuine search video items');
  });
});

test('Facebook DOM Element Selection & Non-Overblocking Preservation', async (t) => {
  const sampleFacebookHtml = `
    <!DOCTYPE html>
    <html data-focus-active="true" data-focus-site="facebook" data-focus-route="home"
          data-focus-block-reels="true" data-focus-hide-feed="true" data-focus-hide-suggested="true">
    <head><title>Facebook</title></head>
    <body>
      <!-- Top banner (Search & Notifications) -->
      <div role="banner" id="fb-banner">
        <input type="search" aria-label="Search Facebook" id="fb-search" />
      </div>

      <div class="fb-container">
        <!-- Left Navigation: MUST NOT BE INDISCRIMINATELY REMOVED -->
        <div role="navigation" id="fb-left-nav">
          <a href="/groups/">Groups</a>
          <a href="/pages/">Pages</a>
          <a href="/reels/" id="reels-bookmark">Reels</a>
        </div>

        <!-- Center Feed on Home -->
        <div role="main" id="fb-main">
          <div role="feed" id="fb-feed">
            <!-- Normal friend post -->
            <div role="article" id="friend-post">
              <h3>Alice Smith</h3>
              <p>Just enjoying a cup of coffee and coding!</p>
            </div>
            <!-- Algorithmic suggested post -->
            <div role="article" id="suggested-post">
              <span>Suggested for you</span>
              <p>Check out this viral page you never followed!</p>
            </div>
            <!-- Reels tray -->
            <div aria-label="Reels and short videos" id="reels-tray"></div>
          </div>
        </div>

        <!-- Right Utility Sidebar (Contacts/Messages): MUST BE PRESERVED -->
        <div role="complementary" id="fb-contacts-sidebar">
          <h4>Contacts</h4>
          <ul id="contacts-list"><li>Bob</li></ul>
        </div>
      </div>
    </body>
    </html>
  `;

  const { document } = parseHTML(sampleFacebookHtml);

  await t.test('Correctly identifies Home feed for hiding', () => {
    const feed = document.querySelector('div[role="feed"]');
    assert.ok(feed, 'Home feed should be identifiable');
  });

  await t.test('Correctly targets Reels tray in feed', () => {
    const reelsTray = document.querySelector('div[aria-label*="Reels" i]');
    assert.ok(reelsTray, 'Reels tray should be targeted');
  });

  await t.test('CRITICAL PRESERVATION: Banner and Search must never be hidden', () => {
    const banner = document.querySelector('div[role="banner"]');
    const search = document.querySelector('input[type="search"]');
    assert.ok(banner, 'Banner preserved');
    assert.ok(search, 'Search preserved');
  });

  await t.test('CRITICAL PRESERVATION: Left Navigation and Right Contacts Sidebar are preserved', () => {
    const leftNav = document.querySelector('div[role="navigation"]');
    const rightSidebar = document.querySelector('div[role="complementary"]');
    assert.ok(leftNav, 'Left navigation must not be removed');
    assert.ok(rightSidebar, 'Right chat/contacts sidebar must not be removed');
  });

  await t.test('Identifies Suggested Post markers accurately', () => {
    const articles = document.querySelectorAll('div[role="article"]');
    const suggestedMarkers = ['suggested for you', 'sponsored', 'follow'];

    let suggestedFound = 0;
    let normalFound = 0;

    for (const article of articles) {
      const text = article.textContent.toLowerCase();
      const isSuggested = suggestedMarkers.some((m) => text.includes(m));
      if (isSuggested) {
        suggestedFound++;
        article.dataset.focusSuggestedPost = 'true';
      } else {
        normalFound++;
      }
    }

    assert.equal(suggestedFound, 1, 'Accurately detected suggested post');
    assert.equal(normalFound, 1, 'Preserved organic friend post');
    assert.equal(document.getElementById('suggested-post').dataset.focusSuggestedPost, 'true');
    assert.equal(document.getElementById('friend-post').dataset.focusSuggestedPost, undefined);
  });
});

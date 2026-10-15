import test from 'node:test';
import assert from 'node:assert/strict';

// YouTube route classifier logic
function classifyYouTubeRoute(urlStr) {
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

function getYouTubeShortsVideoId(urlStr) {
  try {
    const url = new URL(urlStr);
    const match = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Facebook route classifier logic
function classifyFacebookRoute(urlStr) {
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

test('YouTube Route Classification', async (t) => {
  await t.test('detects Home route', () => {
    assert.equal(classifyYouTubeRoute('https://www.youtube.com/'), 'home');
    assert.equal(classifyYouTubeRoute('https://www.youtube.com'), 'home');
  });

  await t.test('detects Shorts routes and extracts video ID', () => {
    assert.equal(classifyYouTubeRoute('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'shorts');
    assert.equal(classifyYouTubeRoute('https://www.youtube.com/shorts/'), 'shorts');
    assert.equal(getYouTubeShortsVideoId('https://www.youtube.com/shorts/xyz123_-abc'), 'xyz123_-abc');
    assert.equal(getYouTubeShortsVideoId('https://www.youtube.com/watch?v=xyz123'), null);
  });

  await t.test('detects Watch route for ordinary video playback', () => {
    assert.equal(classifyYouTubeRoute('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'watch');
  });

  await t.test('detects Search results route', () => {
    assert.equal(classifyYouTubeRoute('https://www.youtube.com/results?search_query=focus+mode'), 'search');
  });

  await t.test('detects Subscriptions route', () => {
    assert.equal(classifyYouTubeRoute('https://www.youtube.com/feed/subscriptions'), 'subscriptions');
  });

  await t.test('detects Channel routes', () => {
    assert.equal(classifyYouTubeRoute('https://www.youtube.com/@GoogleDeepMind'), 'channel');
    assert.equal(classifyYouTubeRoute('https://www.youtube.com/channel/UCxxxxxx'), 'channel');
    assert.equal(classifyYouTubeRoute('https://www.youtube.com/c/CreatorName'), 'channel');
  });
});

test('Facebook Route Classification', async (t) => {
  await t.test('detects Home feed route', () => {
    assert.equal(classifyFacebookRoute('https://www.facebook.com/'), 'home');
    assert.equal(classifyFacebookRoute('https://web.facebook.com/'), 'home');
  });

  await t.test('detects Reels routes', () => {
    assert.equal(classifyFacebookRoute('https://www.facebook.com/reel/1234567890'), 'reels');
    assert.equal(classifyFacebookRoute('https://www.facebook.com/reels/'), 'reels');
  });

  await t.test('detects Search route', () => {
    assert.equal(classifyFacebookRoute('https://www.facebook.com/search/top/?q=react'), 'search');
  });

  await t.test('detects Groups, Pages, and Messages routes', () => {
    assert.equal(classifyFacebookRoute('https://www.facebook.com/groups/coding/'), 'groups');
    assert.equal(classifyFacebookRoute('https://www.facebook.com/pages/category/community'), 'pages');
    assert.equal(classifyFacebookRoute('https://www.facebook.com/messages/t/12345'), 'messages');
  });

  await t.test('detects Direct Post and Permalink routes', () => {
    assert.equal(classifyFacebookRoute('https://www.facebook.com/someone/posts/999888'), 'post');
    assert.equal(classifyFacebookRoute('https://www.facebook.com/permalink.php?story_fbid=123'), 'post');
  });
});

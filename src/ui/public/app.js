const banner = document.getElementById('banner');
const bannerStatus = document.getElementById('banner-status');
const bannerDetail = document.getElementById('banner-detail');
const statsEl = document.getElementById('stats');
const postsEl = document.getElementById('posts');
const runsEl = document.getElementById('runs');
const topicsEl = document.getElementById('topics');
const updatedEl = document.getElementById('updated');

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function linkedinUrl(urn) {
  return `https://www.linkedin.com/feed/update/${encodeURIComponent(urn)}`;
}

function renderStats(data) {
  const cards = [
    ['Published', data.stats.published],
    ['Failed runs', data.stats.failed],
    ['Dry runs', data.stats.dryRuns],
    ['Topics cooling down', data.stats.topicsInCooldown],
    ['Next run', formatDate(data.nextRunAt)],
  ];
  statsEl.innerHTML = cards
    .map(
      ([label, value]) =>
        `<div class="stat"><span class="meta">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`,
    )
    .join('');
}

function renderPosts(posts) {
  if (!posts.length) {
    postsEl.innerHTML = '<p class="muted">No posts yet.</p>';
    return;
  }

  postsEl.innerHTML = posts
    .map((post) => {
      const link = post.linkedinPostId
        ? `<a href="${linkedinUrl(post.linkedinPostId)}" target="_blank" rel="noreferrer">Open on LinkedIn</a>`
        : '<span class="muted">Not published</span>';
      return `
        <article class="item">
          <div class="item-head">
            <div>
              <strong>${escapeHtml(post.topic)}</strong>
              <div class="meta">${escapeHtml(post.category)} · ${escapeHtml(post.contentType)}</div>
            </div>
            <span class="badge ${escapeHtml(post.status)}">${escapeHtml(post.status)}</span>
          </div>
          <p class="meta">${formatDate(post.publishedAt || post.generatedAt)} · ${link}</p>
          <details>
            <summary>Preview</summary>
            <p>${escapeHtml(post.content || post.hook)}</p>
          </details>
        </article>`;
    })
    .join('');
}

function renderRuns(runs) {
  if (!runs.length) {
    runsEl.innerHTML = '<p class="muted">No runs yet.</p>';
    return;
  }

  runsEl.innerHTML = runs
    .slice(0, 12)
    .map((run) => {
      const error = run.error ? `<p class="error">${escapeHtml(run.error)}</p>` : '';
      return `
        <article class="item">
          <div class="item-head">
            <div>
              <strong>${escapeHtml(run.topic || 'No topic')}</strong>
              <div class="meta">${escapeHtml(run.runId)}</div>
            </div>
            <span class="badge ${escapeHtml(run.status)}">${escapeHtml(run.status)}</span>
          </div>
          <p class="meta">${formatDate(run.startedAt)} · ${run.generationAttempts} gen / ${run.publicationAttempts} publish</p>
          ${error}
        </article>`;
    })
    .join('');
}

function renderTopics(topics) {
  topicsEl.innerHTML = topics
    .map(
      (topic) => `
        <tr>
          <td>${escapeHtml(topic.topic)}</td>
          <td>${escapeHtml(topic.category)}</td>
          <td>${formatDate(topic.lastUsed)}</td>
          <td>${topic.inCooldown ? `${topic.daysRemaining} days` : 'Available'}</td>
        </tr>`,
    )
    .join('');
}

async function loadDashboard() {
  updatedEl.textContent = 'Refreshing…';
  const response = await fetch('/api/status', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const data = await response.json();
  const status = data.stats.lastStatus || 'unknown';
  banner.className = `status-banner ${status}`;
  bannerStatus.textContent =
    status === 'success'
      ? 'Last run published successfully'
      : status === 'failed'
        ? 'Last run failed'
        : status === 'dry_run'
          ? 'Last run was a dry run'
          : 'No runs recorded yet';
  bannerDetail.textContent = `${data.scheduleLabel}. Next run ${formatDate(data.nextRunAt)}.`;
  renderStats(data);
  renderPosts(data.posts);
  renderRuns(data.runs);
  renderTopics(data.topics);
  updatedEl.textContent = `Updated ${formatDate(data.generatedAt)} · ${data.profileName}`;
}

document.getElementById('refresh').addEventListener('click', () => {
  loadDashboard().catch((error) => {
    banner.className = 'status-banner failed';
    bannerStatus.textContent = 'Could not load monitor data';
    bannerDetail.textContent = error.message;
  });
});

loadDashboard().catch((error) => {
  banner.className = 'status-banner failed';
  bannerStatus.textContent = 'Could not load monitor data';
  bannerDetail.textContent = error.message;
});

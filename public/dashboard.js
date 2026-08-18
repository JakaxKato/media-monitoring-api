const state = { page: 1, limit: 10, totalPages: 1 };

const elements = {
  total: document.querySelector('#total-mentions'),
  sourceCount: document.querySelector('#source-count'),
  latest: document.querySelector('#latest-publication'),
  updated: document.querySelector('#last-updated'),
  resultCount: document.querySelector('#result-count'),
  mentions: document.querySelector('#mentions-list'),
  pagination: document.querySelector('#pagination'),
  sources: document.querySelector('#source-stats'),
  days: document.querySelector('#day-stats'),
  error: document.querySelector('#page-error'),
  form: document.querySelector('#filter-form'),
  sourceFilter: document.querySelector('#source-filter'),
  clear: document.querySelector('#clear-filters')
};

function formatDate(value, includeTime = false) {
  if (!value) return 'No publication date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return new Intl.DateTimeFormat('en-MY', {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' } : {})
  }).format(date);
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-MY').format(value);
}

function showError(message) {
  elements.error.textContent = message;
  elements.error.hidden = false;
}

function clearError() {
  elements.error.textContent = '';
  elements.error.hidden = true;
}

function getFilters() {
  const formData = new FormData(elements.form);
  return new URLSearchParams([...formData.entries()].filter(([, value]) => value !== ''));
}

function renderMentions(mentions) {
  elements.mentions.replaceChildren();
  if (mentions.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = '<td class="table-state" colspan="4">No mentions match these filters.</td>';
    elements.mentions.append(row);
    return;
  }

  for (const mention of mentions) {
    const row = document.createElement('tr');
    const mentionCell = document.createElement('td');
    mentionCell.className = 'mention-cell';
    if (mention.url) {
      const title = document.createElement('a');
      title.className = 'mention-title';
      title.href = mention.url;
      title.target = '_blank';
      title.rel = 'noreferrer noopener';
      title.textContent = mention.title || 'Untitled social post';
      mentionCell.append(title);
    } else {
      const title = document.createElement('span');
      title.className = 'mention-title';
      title.textContent = mention.title || 'Untitled social post';
      mentionCell.append(title);
    }
    const content = document.createElement('span');
    content.className = 'mention-content';
    content.textContent = mention.content || 'No content available';
    mentionCell.append(content);

    const sourceCell = document.createElement('td');
    const source = document.createElement('span');
    source.className = 'source-label';
    source.textContent = mention.source;
    sourceCell.append(source);

    const dateCell = document.createElement('td');
    dateCell.className = 'date-label';
    dateCell.textContent = formatDate(mention.published_at, true);

    const engagementCell = document.createElement('td');
    engagementCell.className = 'engagement-label';
    engagementCell.textContent = formatNumber(mention.engagement);

    row.append(mentionCell, sourceCell, dateCell, engagementCell);
    elements.mentions.append(row);
  }
}

function renderPagination() {
  elements.pagination.replaceChildren();
  if (state.totalPages <= 1) return;

  const previous = document.createElement('button');
  previous.type = 'button';
  previous.textContent = 'Previous';
  previous.disabled = state.page === 1;
  previous.addEventListener('click', () => loadMentions(state.page - 1));
  elements.pagination.append(previous);

  for (let page = 1; page <= state.totalPages; page += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = String(page);
    if (page === state.page) button.setAttribute('aria-current', 'page');
    button.addEventListener('click', () => loadMentions(page));
    elements.pagination.append(button);
  }

  const next = document.createElement('button');
  next.type = 'button';
  next.textContent = 'Next';
  next.disabled = state.page === state.totalPages;
  next.addEventListener('click', () => loadMentions(state.page + 1));
  elements.pagination.append(next);
}

function renderBars(container, rows, emptyText) {
  container.replaceChildren();
  if (rows.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'panel-state';
    empty.textContent = emptyText;
    container.append(empty);
    return;
  }

  const maximum = Math.max(...rows.map((row) => row.count));
  for (const row of rows) {
    const item = document.createElement('div');
    item.className = 'bar-row';
    const name = document.createElement('span');
    name.className = 'bar-name';
    name.title = row.group;
    name.textContent = row.group;
    const track = document.createElement('span');
    track.className = 'bar-track';
    const fill = document.createElement('span');
    fill.className = 'bar-fill';
    fill.style.width = `${(row.count / maximum) * 100}%`;
    track.append(fill);
    const value = document.createElement('span');
    value.className = 'bar-value';
    value.textContent = formatNumber(row.count);
    item.append(name, track, value);
    container.append(item);
  }
}

async function loadSources() {
  const response = await fetch('/mentions/stats?group_by=source');
  if (!response.ok) throw new Error('Could not load source statistics.');
  const result = await response.json();
  elements.sourceFilter.replaceChildren(new Option('All sources', ''));
  for (const row of result.data) elements.sourceFilter.append(new Option(row.group, row.group));
  elements.sourceCount.textContent = formatNumber(result.data.length);
  renderBars(elements.sources, result.data, 'No source data yet.');
}

async function loadDays() {
  const response = await fetch('/mentions/stats?group_by=day');
  if (!response.ok) throw new Error('Could not load daily statistics.');
  const result = await response.json();
  renderBars(elements.days, result.data, 'No dated mentions yet.');
}

async function loadMentions(page = 1) {
  state.page = page;
  elements.resultCount.textContent = 'Loading mentions…';
  const params = getFilters();
  params.set('page', String(page));
  params.set('limit', String(state.limit));
  const response = await fetch(`/mentions?${params}`);
  if (!response.ok) throw new Error('Could not load mentions.');
  const result = await response.json();
  state.totalPages = result.meta.total_pages;
  elements.resultCount.textContent = `${formatNumber(result.meta.total)} result${result.meta.total === 1 ? '' : 's'}`;
  elements.total.textContent = formatNumber(result.meta.total);
  renderMentions(result.data);
  renderPagination();
  const latest = result.data.find((mention) => mention.published_at);
  if (latest) elements.latest.textContent = formatDate(latest.published_at);
  elements.updated.textContent = `Updated ${formatDate(new Date().toISOString(), true)}`;
}

async function loadDashboard() {
  clearError();
  try {
    await Promise.all([loadMentions(), loadSources(), loadDays()]);
  } catch (error) {
    elements.resultCount.textContent = 'Unable to load data';
    showError(error instanceof Error ? error.message : 'The dashboard could not load data.');
  }
}

elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  loadDashboard();
});
elements.clear.addEventListener('click', () => {
  elements.form.reset();
  loadDashboard();
});
loadDashboard();

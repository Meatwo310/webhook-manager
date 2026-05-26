const state = {
  destinations: [],
  hooks: [],
  timers: [],
  deliveries: [],
  feedsByTimer: new Map(),
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const statusNode = $('[data-status]');

document.addEventListener('DOMContentLoaded', () => {
  bindTabs();
  bindActions();
  bindForms();
  void refreshAll();
});

function bindTabs() {
  $$('[data-tab-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.tabTarget;
      $$('[data-tab-target]').forEach((item) => item.classList.toggle('is-active', item === button));
      $$('[data-tab-panel]').forEach((panel) => {
        panel.classList.toggle('is-active', panel.dataset.tabPanel === target);
      });
    });
  });
}

function bindActions() {
  $('[data-action="refresh"]')?.addEventListener('click', () => void refreshAll());
  $('[data-action="run-rss"]')?.addEventListener('click', () => void runRss());
  $('[data-action="refresh-deliveries"]')?.addEventListener('click', () => void refreshDeliveries());
  $('[data-action="close-edit"]')?.addEventListener('click', () => closeEditDialog());
  $('[data-action="cancel-edit"]')?.addEventListener('click', () => closeEditDialog());
  $('[data-action="generate-token"]')?.addEventListener('click', () => {
    const input = $('[data-form="hook"] [name="pathToken"]');
    input.value = generateToken();
    input.focus();
  });
  $('[data-filter="sourceType"]')?.addEventListener('change', () => void refreshDeliveries());

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-row-action]');
    if (!button) {
      return;
    }

    void handleRowAction(button);
  });
}

function bindForms() {
  $('[data-form="destination"]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    void withUiErrors(() => createDestination(event.currentTarget));
  });
  $('[data-form="hook"]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    void withUiErrors(() => createHook(event.currentTarget));
  });
  $('[data-form="timer"]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    void withUiErrors(() => createTimer(event.currentTarget));
  });
  $('[data-form="feed"]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    void withUiErrors(() => createFeed(event.currentTarget));
  });
  $('[data-form="edit"]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    void withUiErrors(() => saveEdit(event.currentTarget));
  });
}

async function refreshAll() {
  setStatus('Loading...');
  const [destinations, hooks, timers] = await Promise.all([
    api('/api/destinations').then((data) => data.destinations),
    api('/api/hooks').then((data) => data.hooks),
    api('/api/timers').then((data) => data.timers),
  ]);

  state.destinations = destinations;
  state.hooks = hooks;
  state.timers = timers;
  await refreshFeeds();
  await refreshDeliveries();
  render();
  setStatus('Ready.');
}

async function refreshFeeds() {
  const pairs = await Promise.all(
    state.timers.map(async (timer) => {
      const data = await api(`/api/timers/${timer.id}/feeds`);
      return [timer.id, data.feeds];
    }),
  );
  state.feedsByTimer = new Map(pairs);
}

async function refreshDeliveries() {
  const sourceType = $('[data-filter="sourceType"]')?.value;
  const query = new URLSearchParams({ limit: '25' });
  if (sourceType) {
    query.set('sourceType', sourceType);
  }

  const data = await api(`/api/deliveries?${query.toString()}`);
  state.deliveries = data.deliveries;
  renderDeliveries();
  updateMetrics();
}

async function createDestination(form) {
  const formData = new FormData(form);
  await api('/api/destinations', {
    method: 'POST',
    body: {
      name: valueOf(formData, 'name'),
      webhookUrl: valueOf(formData, 'webhookUrl'),
      threadId: nullableValueOf(formData, 'threadId'),
      username: nullableValueOf(formData, 'username'),
      avatarUrl: nullableValueOf(formData, 'avatarUrl'),
      isActive: formData.has('isActive'),
    },
  });
  form.reset();
  form.elements.isActive.checked = true;
  await refreshAll();
  setStatus('Destination created.');
}

async function createHook(form) {
  const formData = new FormData(form);
  const configJson = parseJsonText(valueOf(formData, 'configJson') || '{}');
  await api('/api/hooks', {
    method: 'POST',
    body: {
      name: valueOf(formData, 'name'),
      kind: 'statuspage',
      pathToken: valueOf(formData, 'pathToken'),
      destinationId: valueOf(formData, 'destinationId'),
      configJson,
      isActive: formData.has('isActive'),
    },
  });
  form.reset();
  form.elements.configJson.value = '{}';
  form.elements.isActive.checked = true;
  await refreshAll();
  setStatus('Hook created.');
}

async function createTimer(form) {
  const formData = new FormData(form);
  const maxItems = Number(valueOf(formData, 'maxItems'));
  await api('/api/timers', {
    method: 'POST',
    body: {
      name: valueOf(formData, 'name'),
      kind: 'rss',
      destinationId: valueOf(formData, 'destinationId'),
      configJson: {
        max_items_per_run: Number.isInteger(maxItems) ? maxItems : 5,
        post_on_first_run: formData.has('postOnFirstRun'),
      },
      isActive: formData.has('isActive'),
    },
  });
  form.reset();
  form.elements.maxItems.value = '5';
  form.elements.isActive.checked = true;
  await refreshAll();
  setStatus('Timer created.');
}

async function createFeed(form) {
  const formData = new FormData(form);
  const timerId = valueOf(formData, 'timerId');
  await api(`/api/timers/${timerId}/feeds`, {
    method: 'POST',
    body: {
      feedUrl: valueOf(formData, 'feedUrl'),
      title: nullableValueOf(formData, 'title'),
    },
  });
  form.reset();
  await refreshAll();
  setStatus('Feed added.');
}

async function handleRowAction(button) {
  const { rowAction, id } = button.dataset;

  if (rowAction?.startsWith('edit-')) {
    openEditDialog(rowAction.replace('edit-', ''), id);
    return;
  }

  if (rowAction === 'test-destination') {
    await api(`/api/destinations/${id}/test`, { method: 'POST' });
    setStatus('Test message sent.');
    return;
  }

  const disableTargets = {
    'disable-destination': `/api/destinations/${id}`,
    'disable-hook': `/api/hooks/${id}`,
    'disable-timer': `/api/timers/${id}`,
  };

  if (disableTargets[rowAction]) {
    await api(disableTargets[rowAction], {
      method: 'PATCH',
      body: { isActive: false },
    });
    await refreshAll();
    setStatus('Disabled.');
    return;
  }

  const reenableTargets = {
    'enable-destination': `/api/destinations/${id}`,
    'enable-hook': `/api/hooks/${id}`,
    'enable-timer': `/api/timers/${id}`,
  };

  if (reenableTargets[rowAction]) {
    await api(reenableTargets[rowAction], {
      method: 'PATCH',
      body: { isActive: true },
    });
    await refreshAll();
    setStatus('Re-enabled.');
    return;
  }

  const deleteTargets = {
    'delete-destination': `/api/destinations/${id}`,
    'delete-hook': `/api/hooks/${id}`,
    'delete-timer': `/api/timers/${id}`,
    'delete-feed': `/api/rss-feeds/${id}`,
  };

  if (deleteTargets[rowAction]) {
    if (!confirm('Delete this entry permanently?')) {
      return;
    }
    await api(deleteTargets[rowAction], { method: 'DELETE' });
    await refreshAll();
    setStatus('Deleted.');
  }
}

function openEditDialog(type, id) {
  const dialog = $('[data-edit-dialog]');
  const form = $('[data-form="edit"]');
  const fields = $('[data-edit-fields]');
  const title = $('[data-edit-title]');
  const item = findEditable(type, id);

  if (!dialog || !form || !fields || !title || !item) {
    setStatus('Editable entry was not found.', true);
    return;
  }

  form.reset();
  form.elements.type.value = type;
  form.elements.id.value = id;
  title.textContent = `Edit ${editTypeLabel(type)}`;
  fields.innerHTML = editFieldsHtml(type, item);
  renderEditDestinationOptions(fields, item.destinationId);

  if (type === 'timer') {
    const config = timerConfig(item);
    form.elements.maxItems.value = String(config.max_items_per_run ?? 5);
    form.elements.postOnFirstRun.checked = Boolean(config.post_on_first_run);
  }

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
}

function closeEditDialog() {
  const dialog = $('[data-edit-dialog]');
  if (!dialog) {
    return;
  }

  if (typeof dialog.close === 'function') {
    dialog.close();
  } else {
    dialog.removeAttribute('open');
  }
}

async function saveEdit(form) {
  const formData = new FormData(form);
  const type = valueOf(formData, 'type');
  const id = valueOf(formData, 'id');
  const { path, body } = editRequest(type, id, formData);

  await api(path, { method: 'PATCH', body });
  closeEditDialog();
  await refreshAll();
  setStatus('Saved.');
}

function editRequest(type, id, formData) {
  if (type === 'destination') {
    return {
      path: `/api/destinations/${id}`,
      body: {
        name: valueOf(formData, 'name'),
        webhookUrl: valueOf(formData, 'webhookUrl'),
        threadId: nullableValueOf(formData, 'threadId'),
        username: nullableValueOf(formData, 'username'),
        avatarUrl: nullableValueOf(formData, 'avatarUrl'),
        isActive: formData.has('isActive'),
      },
    };
  }

  if (type === 'hook') {
    return {
      path: `/api/hooks/${id}`,
      body: {
        name: valueOf(formData, 'name'),
        kind: 'statuspage',
        pathToken: valueOf(formData, 'pathToken'),
        destinationId: valueOf(formData, 'destinationId'),
        configJson: parseJsonText(valueOf(formData, 'configJson') || '{}'),
        isActive: formData.has('isActive'),
      },
    };
  }

  if (type === 'timer') {
    const maxItems = Number(valueOf(formData, 'maxItems'));
    return {
      path: `/api/timers/${id}`,
      body: {
        name: valueOf(formData, 'name'),
        kind: 'rss',
        destinationId: valueOf(formData, 'destinationId'),
        configJson: {
          max_items_per_run: Number.isInteger(maxItems) ? maxItems : 5,
          post_on_first_run: formData.has('postOnFirstRun'),
        },
        isActive: formData.has('isActive'),
      },
    };
  }

  if (type === 'feed') {
    return {
      path: `/api/rss-feeds/${id}`,
      body: {
        feedUrl: valueOf(formData, 'feedUrl'),
        title: nullableValueOf(formData, 'title'),
      },
    };
  }

  throw new Error('Unsupported edit target.');
}

async function runRss() {
  const data = await api('/api/timers/rss/run', { method: 'POST' });
  await refreshAll();
  setStatus(`RSS run: ${data.result.posted} posted, ${data.result.failed} failed.`);
}

function render() {
  renderDestinationOptions();
  renderDestinations();
  renderHooks();
  renderTimers();
  renderFeeds();
  renderDeliveries();
  updateMetrics();
}

function renderDestinationOptions() {
  const activeDestinations = state.destinations.filter((destination) => destination.isActive);
  $$('select[name="destinationId"]').forEach((select) => {
    const selected = select.value;
    select.replaceChildren(...activeDestinations.map((destination) => option(destination.id, destination.name)));
    if (activeDestinations.some((destination) => destination.id === selected)) {
      select.value = selected;
    }
  });

  const timerSelect = $('select[name="timerId"]');
  if (timerSelect) {
    const selected = timerSelect.value;
    timerSelect.replaceChildren(...state.timers.map((timer) => option(timer.id, timer.name)));
    if (state.timers.some((timer) => timer.id === selected)) {
      timerSelect.value = selected;
    }
  }
}

function renderDestinations() {
  const body = $('[data-list="destinations"]');
  body.replaceChildren(...state.destinations.map((destination) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(destination.name)}</td>
      <td><span class="muted">${maskWebhook(destination.webhookUrl)}</span></td>
      <td>${escapeHtml(destination.threadId || '-')}</td>
      <td>${statusPill(destination.isActive)}</td>
      <td>${formatDate(destination.createdAt)}</td>
      <td>${destinationActions(destination)}</td>
    `;
    return row;
  }));
}

function renderHooks() {
  const body = $('[data-list="hooks"]');
  body.replaceChildren(...state.hooks.map((hook) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(hook.name)}</td>
      <td>${escapeHtml(hook.kind)}</td>
      <td><code>/hooks/${escapeHtml(hook.pathToken)}</code></td>
      <td>${escapeHtml(destinationName(hook.destinationId))}</td>
      <td>${statusPill(hook.isActive)}</td>
      <td>${hookActions(hook)}</td>
    `;
    return row;
  }));
}

function renderTimers() {
  const body = $('[data-list="timers"]');
  body.replaceChildren(...state.timers.map((timer) => {
    const feeds = state.feedsByTimer.get(timer.id) ?? [];
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(timer.name)}</td>
      <td>${escapeHtml(destinationName(timer.destinationId))}</td>
      <td><code>${escapeHtml(timer.configJson)}</code></td>
      <td>${feeds.map((feed) => `<div>${escapeHtml(feed.title || feed.feedUrl)}</div>`).join('') || '-'}</td>
      <td>${statusPill(timer.isActive)}</td>
      <td>${timerActions(timer)}</td>
    `;
    return row;
  }));
}

function renderFeeds() {
  const body = $('[data-list="feeds"]');
  if (!body) {
    return;
  }

  const rows = state.timers.flatMap((timer) => {
    return (state.feedsByTimer.get(timer.id) ?? []).map((feed) => ({ timer, feed }));
  });

  body.replaceChildren(...rows.map(({ timer, feed }) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(timer.name)}</td>
      <td>${escapeHtml(feed.title || '-')}</td>
      <td><code>${escapeHtml(feed.feedUrl)}</code></td>
      <td>${formatDate(feed.createdAt)}</td>
      <td><div class="row-actions"><button type="button" class="icon-button" data-row-action="edit-feed" data-id="${feed.id}" title="Edit feed" aria-label="Edit feed">✎</button><button type="button" class="icon-button danger" data-row-action="delete-feed" data-id="${feed.id}" title="Delete feed" aria-label="Delete feed">⌫</button></div></td>
    `;
    return row;
  }));
}

function renderDeliveries() {
  const body = $('[data-list="deliveries"]');
  if (!body) {
    return;
  }

  body.replaceChildren(...state.deliveries.map((delivery) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatDate(delivery.createdAt)}</td>
      <td>${escapeHtml(delivery.sourceType)}<br><code>${escapeHtml(shortId(delivery.sourceId))}</code></td>
      <td>${escapeHtml(destinationName(delivery.destinationId))}</td>
      <td>${deliveryStatusPill(delivery.status)}</td>
      <td>${delivery.responseStatus ?? '-'}</td>
      <td class="error-cell">${escapeHtml(delivery.errorMessage || '-')}</td>
    `;
    return row;
  }));
}

function updateMetrics() {
  setMetric('destinations', state.destinations.length);
  setMetric('hooks', state.hooks.length);
  setMetric('timers', state.timers.length);
  setMetric('deliveries', state.deliveries.length);
}

function destinationActions(destination) {
  const editButton = `<button type="button" class="icon-button" data-row-action="edit-destination" data-id="${destination.id}" title="Edit" aria-label="Edit">✎</button>`;
  const testButton = destination.isActive
    ? `<button type="button" class="icon-button" data-row-action="test-destination" data-id="${destination.id}" title="Send test" aria-label="Send test">▶</button>`
    : '';
  const disableButton = destination.isActive
    ? `<button type="button" class="icon-button danger" data-row-action="disable-destination" data-id="${destination.id}" title="Disable" aria-label="Disable">×</button>`
    : `<button type="button" class="icon-button" data-row-action="enable-destination" data-id="${destination.id}" title="Re-enable" aria-label="Re-enable">✓</button>`;
  const deleteButton = destination.isActive
    ? ''
    : `<button type="button" class="icon-button danger" data-row-action="delete-destination" data-id="${destination.id}" title="Delete" aria-label="Delete">⌫</button>`;
  return `<div class="row-actions">${editButton}${testButton}${disableButton}${deleteButton}</div>`;
}

function hookActions(hook) {
  const editButton = `<button type="button" class="icon-button" data-row-action="edit-hook" data-id="${hook.id}" title="Edit" aria-label="Edit">✎</button>`;
  if (!hook.isActive) {
    return `<div class="row-actions">${editButton}<button type="button" class="icon-button" data-row-action="enable-hook" data-id="${hook.id}" title="Re-enable" aria-label="Re-enable">✓</button><button type="button" class="icon-button danger" data-row-action="delete-hook" data-id="${hook.id}" title="Delete" aria-label="Delete">⌫</button></div>`;
  }

  return `<div class="row-actions">${editButton}<button type="button" class="icon-button danger" data-row-action="disable-hook" data-id="${hook.id}" title="Disable" aria-label="Disable">×</button></div>`;
}

function timerActions(timer) {
  const editButton = `<button type="button" class="icon-button" data-row-action="edit-timer" data-id="${timer.id}" title="Edit" aria-label="Edit">✎</button>`;
  if (!timer.isActive) {
    return `<div class="row-actions">${editButton}<button type="button" class="icon-button" data-row-action="enable-timer" data-id="${timer.id}" title="Re-enable" aria-label="Re-enable">✓</button><button type="button" class="icon-button danger" data-row-action="delete-timer" data-id="${timer.id}" title="Delete" aria-label="Delete">⌫</button></div>`;
  }

  return `<div class="row-actions">${editButton}<button type="button" class="icon-button danger" data-row-action="disable-timer" data-id="${timer.id}" title="Disable" aria-label="Disable">×</button></div>`;
}

function findEditable(type, id) {
  if (type === 'destination') {
    return state.destinations.find((destination) => destination.id === id);
  }

  if (type === 'hook') {
    return state.hooks.find((hook) => hook.id === id);
  }

  if (type === 'timer') {
    return state.timers.find((timer) => timer.id === id);
  }

  if (type === 'feed') {
    return [...state.feedsByTimer.values()].flat().find((feed) => feed.id === id);
  }

  return null;
}

function editTypeLabel(type) {
  return {
    destination: 'destination',
    hook: 'hook',
    timer: 'timer',
    feed: 'feed',
  }[type] ?? 'entry';
}

function editFieldsHtml(type, item) {
  if (type === 'destination') {
    return `
      ${textField('name', 'Name', item.name, true)}
      ${textField('webhookUrl', 'Webhook URL', item.webhookUrl, true, 'url', 'wide')}
      ${textField('threadId', 'Thread ID', item.threadId ?? '')}
      ${textField('username', 'Username', item.username ?? '')}
      ${textField('avatarUrl', 'Avatar URL', item.avatarUrl ?? '', false, 'url')}
      ${checkboxField('isActive', 'Active', item.isActive)}
    `;
  }

  if (type === 'hook') {
    return `
      ${textField('name', 'Name', item.name, true)}
      ${selectField('destinationId', 'Destination')}
      ${textField('pathToken', 'Path token', item.pathToken, true, 'text', 'wide')}
      ${textareaField('configJson', 'Config JSON', item.configJson || '{}', 'wide')}
      ${checkboxField('isActive', 'Active', item.isActive)}
    `;
  }

  if (type === 'timer') {
    return `
      ${textField('name', 'Name', item.name, true)}
      ${selectField('destinationId', 'Destination')}
      ${numberField('maxItems', 'Max items', 5, 1, 20)}
      ${checkboxField('postOnFirstRun', 'Post first run', false)}
      ${checkboxField('isActive', 'Active', item.isActive)}
    `;
  }

  if (type === 'feed') {
    return `
      ${textField('feedUrl', 'Feed URL', item.feedUrl, true, 'url', 'wide')}
      ${textField('title', 'Title', item.title ?? '')}
    `;
  }

  return '';
}

function renderEditDestinationOptions(root, selectedId) {
  const select = $('select[name="destinationId"]', root);
  if (!select) {
    return;
  }

  select.replaceChildren(...state.destinations.map((destination) => option(destination.id, destination.name)));
  select.value = selectedId;
}

function textField(name, label, value, required = false, type = 'text', className = '') {
  return `
    <label class="${className}">
      <span>${escapeHtml(label)}</span>
      <input name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeAttribute(value)}" autocomplete="off" ${required ? 'required' : ''} />
    </label>
  `;
}

function numberField(name, label, value, min, max) {
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <input name="${escapeHtml(name)}" type="number" min="${min}" max="${max}" value="${escapeAttribute(value)}" required />
    </label>
  `;
}

function selectField(name, label) {
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <select name="${escapeHtml(name)}" required></select>
    </label>
  `;
}

function textareaField(name, label, value, className = '') {
  return `
    <label class="${className}">
      <span>${escapeHtml(label)}</span>
      <textarea name="${escapeHtml(name)}" rows="4">${escapeHtml(value)}</textarea>
    </label>
  `;
}

function checkboxField(name, label, checked) {
  return `
    <label class="check-row">
      <input name="${escapeHtml(name)}" type="checkbox" ${checked ? 'checked' : ''} />
      <span>${escapeHtml(label)}</span>
    </label>
  `;
}

function timerConfig(timer) {
  try {
    return JSON.parse(timer.configJson || '{}');
  } catch {
    return {};
  }
}

async function api(path, options = {}) {
  const init = {
    method: options.method ?? 'GET',
    headers: options.body ? { 'content-type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  };
  const response = await fetch(path, init);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error?.message ?? `Request failed: ${response.status}`;
    setStatus(message, true);
    throw new Error(message);
  }

  return data;
}

async function withUiErrors(task) {
  try {
    await task();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), true);
  }
}

function parseJsonText(value) {
  try {
    JSON.parse(value);
    return value;
  } catch {
    throw new Error('Config JSON is invalid.');
  }
}

function valueOf(formData, key) {
  return String(formData.get(key) ?? '').trim();
}

function nullableValueOf(formData, key) {
  const value = valueOf(formData, key);
  return value || null;
}

function setMetric(key, value) {
  const node = $(`[data-metric="${key}"]`);
  if (node) {
    node.textContent = String(value);
  }
}

function setStatus(message, isError = false) {
  if (!statusNode) {
    return;
  }

  statusNode.textContent = message;
  statusNode.classList.toggle('is-error', isError);
}

function destinationName(id) {
  return state.destinations.find((destination) => destination.id === id)?.name ?? shortId(id);
}

function option(value, label) {
  const item = document.createElement('option');
  item.value = value;
  item.textContent = label;
  return item;
}

function statusPill(isActive) {
  return `<span class="pill ${isActive ? 'success' : 'muted-pill'}">${isActive ? 'active' : 'inactive'}</span>`;
}

function deliveryStatusPill(status) {
  const className = status === 'success' ? 'success' : status === 'failed' ? 'danger-pill' : 'muted-pill';
  return `<span class="pill ${className}">${escapeHtml(status)}</span>`;
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function shortId(value) {
  return value ? `${value.slice(0, 8)}...` : '-';
}

function maskWebhook(value) {
  try {
    const url = new URL(value);
    return `${url.hostname}/...`;
  } catch {
    return 'configured';
  }
}

function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

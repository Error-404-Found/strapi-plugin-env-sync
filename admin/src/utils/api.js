/**
 * API utility — typed wrappers around all plugin endpoints.
 *
 * URL structure in Strapi v5 admin panel:
 *   Plugin admin routes are served at: /api/{pluginId}/{route-path}
 *   For env-sync:  /api/env-sync/config, /api/env-sync/logs, etc.
 *
 * The admin panel JWT is read from localStorage (key: 'jwtToken') and
 * sent as Authorization: Bearer header on every request.
 *
 * @module env-sync/admin/src/utils/api
 */

// Base URL — Strapi v5 plugin admin routes sit at /api/{pluginId}/
const BASE = '/api/env-sync';

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function get(path, params = {}) {
  const qs  = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
  ).toString();
  const url = BASE + path + (qs ? '?' + qs : '');
  const res = await fetch(url, { headers: _authHeaders() });
  return _handleResponse(res);
}

async function post(path, body = {}) {
  const res = await fetch(BASE + path, {
    method:  'POST',
    headers: _authHeaders(),
    body:    JSON.stringify(body),
  });
  return _handleResponse(res);
}

// ── Public API ────────────────────────────────────────────────────────────────

export const api = {

  /** Get sanitised plugin config (current env, targets, feature flags). */
  getConfig: () => get('/config'),

  /** Get cached target environment health statuses. */
  getStatus: () => get('/status'),

  /** Force refresh health checks against all configured targets. */
  refreshStatus: () => post('/status/refresh'),

  /**
   * Trigger a sync (or dry-run).
   * @param {object} p
   * @param {string}  p.contentType
   * @param {string}  p.documentId
   * @param {string}  p.targetEnv
   * @param {string|null} p.locale
   * @param {boolean} p.isDryRun
   * @param {string}  [p.conflictStrategyOverride]
   */
  triggerSync: (p) => post('/trigger', p),

  /**
   * Fetch audit logs with optional filters.
   * @param {object} params - { page, pageSize, status, sourceEnv, targetEnv, contentType, dateFrom, dateTo }
   */
  getLogs: (params = {}) => get('/logs', { page: 1, pageSize: 25, ...params }),

  /** Get a single log entry by its Strapi documentId. */
  getLog: (id) => get('/logs/' + id),

  /**
   * Trigger a rollback from a snapshot.
   * @param {string} snapshotDocumentId
   */
  rollback: (snapshotDocumentId) => post('/rollback', { snapshotDocumentId }),

  /**
   * Export logs as CSV — returns a blob URL the caller can download.
   * @param {object} params - same filter params as getLogs
   */
  exportCsv: async (params = {}) => {
    const qs  = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined))
    ).toString();
    const res = await fetch(BASE + '/logs/export' + (qs ? '?' + qs : ''), {
      headers: _authHeaders(),
    });
    if (!res.ok) throw new Error('CSV export failed (' + res.status + ')');
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
};

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Build auth headers including the Strapi admin JWT.
 * Strapi v5 stores the admin token in localStorage under the key 'jwtToken'.
 */
function _authHeaders() {
  const token = _getAdminToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
  };
}

function _getAdminToken() {
  try {
    // Strapi v5 admin JWT key
    return localStorage.getItem('jwtToken') ||
           localStorage.getItem('strapi-admin-token') ||
           '';
  } catch {
    return '';
  }
}

async function _handleResponse(res) {
  let data;
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      'Request failed with status ' + res.status;
    throw new Error(message);
  }

  return data;
}

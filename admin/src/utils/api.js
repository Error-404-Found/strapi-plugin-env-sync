/**
 * API utility for strapi-plugin-env-sync.
 *
 * URL structure in Strapi v5:
 *
 *   ADMIN routes  (type: 'admin')   → served at /admin/{pluginId}/{path}
 *   CONTENT-API routes              → served at /api/{pluginId}/{path}
 *
 * So our endpoints are:
 *   GET  /admin/env-sync/config        ← plugin config
 *   POST /admin/env-sync/trigger       ← trigger sync
 *   GET  /admin/env-sync/logs          ← audit logs
 *   POST /admin/env-sync/rollback      ← rollback
 *   GET  /admin/env-sync/status        ← health status
 *
 * Auth: Strapi admin JWT stored in localStorage under key 'jwtToken'
 *
 * @module env-sync/admin/src/utils/api
 */

const ADMIN_BASE = '/admin/env-sync';

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function get(path, params = {}) {
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  const qs  = new URLSearchParams(cleaned).toString();
  const url = ADMIN_BASE + path + (qs ? '?' + qs : '');
  const res = await fetch(url, { headers: _authHeaders() });
  return _handleResponse(res);
}

async function post(path, body = {}) {
  const res = await fetch(ADMIN_BASE + path, {
    method:  'POST',
    headers: _authHeaders(),
    body:    JSON.stringify(body),
  });
  return _handleResponse(res);
}

// ── Public API ────────────────────────────────────────────────────────────────

export const api = {

  /** Get sanitised plugin config (currentEnv, targets[], feature flags). */
  getConfig: () => get('/config'),

  /** Get cached target environment health statuses. */
  getStatus: () => get('/status'),

  /** Force a health re-check of all configured targets. */
  refreshStatus: () => post('/status/refresh'),

  /**
   * Trigger a sync or dry-run.
   * @param {{ contentType, documentId, targetEnv, locale, isDryRun, conflictStrategyOverride }} p
   */
  triggerSync: (p) => post('/trigger', p),

  /**
   * Fetch paginated audit logs.
   * @param {{ page, pageSize, status, sourceEnv, targetEnv, contentType }} params
   */
  getLogs: (params = {}) => get('/logs', { page: 1, pageSize: 25, ...params }),

  /** Get a single log entry by its Strapi documentId. */
  getLog: (id) => get('/logs/' + id),

  /**
   * Rollback a document from a snapshot.
   * @param {string} snapshotDocumentId
   */
  rollback: (snapshotDocumentId) => post('/rollback', { snapshotDocumentId }),

  /**
   * Export logs as CSV — returns a blob URL.
   * @param {object} params - same filters as getLogs
   */
  exportCsv: async (params = {}) => {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([k, v]) => v !== '' && v !== null && v !== undefined && !['page','pageSize'].includes(k))
    );
    const qs  = new URLSearchParams(cleaned).toString();
    const res = await fetch(ADMIN_BASE + '/logs/export' + (qs ? '?' + qs : ''), {
      headers: _authHeaders(),
    });
    if (!res.ok) throw new Error('CSV export failed (' + res.status + ')');
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
};

// ── Private helpers ───────────────────────────────────────────────────────────

function _authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization:  'Bearer ' + _getAdminToken(),
  };
}

function _getAdminToken() {
  try {
    return (
      localStorage.getItem('jwtToken') ||
      localStorage.getItem('strapi-admin-token') ||
      ''
    );
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
    const msg = data?.error?.message || data?.message || 'Request failed (' + res.status + ')';
    throw new Error(msg);
  }
  return data;
}

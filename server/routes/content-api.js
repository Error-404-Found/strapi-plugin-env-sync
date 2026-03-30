'use strict';

/**
 * Content API routes (machine-to-machine, Bearer token protected).
 *
 * Same rule: DO NOT add /env-sync prefix.
 * Strapi v5 auto-prefixes content-api routes with /{pluginName} too,
 * making /receive accessible at /api/env-sync/receive.
 *
 * @module env-sync/server/routes/content-api
 */

module.exports = {
  type: 'content-api',
  routes: [

    // ── Inbound Sync Receiver ─────────────────────────────────────────────
    {
      method:  'POST',
      path:    '/receive',
      handler: 'receive.receive',
      config: {
        auth:        false,
        middlewares: ['plugin::env-sync.verify-sync-token'],
        description: 'Receive and apply an incoming sync payload from a source environment',
      },
    },

    // ── Peek (pre-sync diff) ──────────────────────────────────────────────
    {
      method:  'POST',
      path:    '/peek',
      handler: 'receive.peek',
      config: {
        auth:        false,
        middlewares: ['plugin::env-sync.verify-sync-token'],
        description: 'Fetch current document state for pre-sync diffing',
      },
    },

    // ── Health check (called by source env) ───────────────────────────────
    {
      method:  'GET',
      path:    '/health',
      handler: 'health.check',
      config: {
        auth:        false,
        middlewares: ['plugin::env-sync.verify-sync-token'],
        description: 'Prove this environment is reachable and the sync token is valid',
      },
    },
  ],
};

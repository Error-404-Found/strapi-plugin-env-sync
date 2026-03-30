'use strict';

/**
 * Admin routes for strapi-plugin-env-sync.
 *
 * IMPORTANT — Strapi v5 route prefix behaviour:
 * Strapi automatically prepends `/{pluginName}` to all plugin routes.
 * For this plugin (id: 'env-sync'), paths here like '/config' become
 * accessible at /api/env-sync/config in the admin panel.
 *
 * DO NOT add /env-sync prefix to these paths — it would result in
 * /api/env-sync/env-sync/config (double prefix = 404).
 *
 * @module env-sync/server/routes/admin
 */

module.exports = {
  type: 'admin',
  routes: [

    // ── Sync Trigger ──────────────────────────────────────────────────────
    {
      method:  'POST',
      path:    '/trigger',
      handler: 'sync.trigger',
      config: {
        policies:    ['plugin::env-sync.canTriggerSync'],
        description: 'Trigger an on-demand content sync to a target environment',
      },
    },

    // ── Plugin Config (any authenticated admin) ───────────────────────────
    {
      method:  'GET',
      path:    '/config',
      handler: 'sync.getConfig',
      config: {
        policies:    [],
        description: 'Get sanitised plugin configuration for the admin UI',
      },
    },

    // ── Audit Logs ────────────────────────────────────────────────────────
    {
      method:  'GET',
      path:    '/logs',
      handler: 'logs.find',
      config: {
        policies:    ['plugin::env-sync.canViewLogs'],
        description: 'Retrieve paginated sync audit logs',
      },
    },
    {
      method:  'GET',
      path:    '/logs/export',
      handler: 'logs.exportCsv',
      config: {
        policies:    ['plugin::env-sync.canViewLogs'],
        description: 'Export sync audit logs as CSV',
      },
    },
    {
      method:  'GET',
      path:    '/logs/:id',
      handler: 'logs.findOne',
      config: {
        policies:    ['plugin::env-sync.canViewLogs'],
        description: 'Retrieve a single sync audit log entry',
      },
    },

    // ── Rollback ──────────────────────────────────────────────────────────
    {
      method:  'POST',
      path:    '/rollback',
      handler: 'logs.rollback',
      config: {
        policies:    ['plugin::env-sync.canRollback'],
        description: 'Restore a document from a pre-sync snapshot',
      },
    },

    // ── Health / Status ───────────────────────────────────────────────────
    {
      method:  'GET',
      path:    '/status',
      handler: 'health.status',
      config: {
        policies:    [],
        description: 'Get cached reachability status of all target environments',
      },
    },
    {
      method:  'POST',
      path:    '/status/refresh',
      handler: 'health.refresh',
      config: {
        policies:    [],
        description: 'Force a health re-check of all configured target environments',
      },
    },
  ],
};

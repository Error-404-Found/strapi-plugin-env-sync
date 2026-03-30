/**
 * strapi-plugin-env-sync — Admin Entry Point
 *
 * Verified against Strapi v5 source (@strapi/admin router.d.ts):
 *
 * addMenuLink requires:
 *   - icon:      React.ElementType  (component reference, NOT a string)
 *   - to:        string             (relative, no leading slash)
 *   - Component: () => Promise<{ default: React.ComponentType }>  (MUST be async)
 *
 * addRoute is NOT needed — addMenuLink creates the route internally
 * using path `${link.to}/*` with lazy loading.
 *
 * Sync button uses content-manager's addDocumentAction API
 * which is the only correct way to add buttons to the edit view in v5.
 *
 * @module strapi-plugin-env-sync/strapi-admin
 */

import { PLUGIN_ID, PLUGIN_ICON, Initializer, SyncButtonAction } from './admin/src/index';

export default {

  register(app) {
    // ── Register plugin (runs Initializer on boot) ───────────────────────
    app.registerPlugin({
      id:          PLUGIN_ID,
      name:        PLUGIN_ID,
      initializer: Initializer,
    });

    // ── Add sidebar menu link + auto-register route ──────────────────────
    // Component MUST be async: () => Promise<{ default: ComponentType }>
    // Strapi uses this for lazy-loading and also registers the route automatically
    // icon MUST be a React.ElementType (component), not a string
    // to MUST be relative (no leading slash)
    app.addMenuLink({
      to:        'plugins/' + PLUGIN_ID,
      icon:      PLUGIN_ICON,
      intlLabel: {
        id:             PLUGIN_ID + '.menu.label',
        defaultMessage: 'Env Sync',
      },
      Component: async () => {
        const { LogsPage } = await import('./admin/src/pages/LogsPage');
        return { default: LogsPage };
      },
      permissions: [
        { action: 'plugin::' + PLUGIN_ID + '.view-logs', subject: null },
      ],
    });
  },

  bootstrap(app) {
    // ── Register Sync Button in the Content Manager edit view ────────────
    // The ONLY correct v5 API — addDocumentAction with position:'header'
    const contentManager = app.getPlugin('content-manager');

    if (!contentManager) {
      console.warn('[env-sync] content-manager plugin not found — sync button unavailable.');
      return;
    }

    if (contentManager.apis?.addDocumentAction) {
      contentManager.apis.addDocumentAction([SyncButtonAction]);
    } else if (contentManager.apis?.addDocumentHeaderAction) {
      contentManager.apis.addDocumentHeaderAction([SyncButtonAction]);
    } else {
      console.warn('[env-sync] addDocumentAction not available on content-manager plugin.');
    }
  },
};

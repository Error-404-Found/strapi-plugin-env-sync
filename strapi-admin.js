/**
 * strapi-plugin-env-sync — Admin Entry Point
 *
 * Strapi v5 correct APIs:
 *
 * 1. Menu icon:    Uses 'ArrowsCounterClockwise' from @strapi/icons (confirmed export)
 * 2. Sync button:  contentManager.apis.addDocumentAction() with position:'header'
 *                  This is the ONLY correct way to add a button to the edit view
 *                  header in Strapi v5. injectContentManagerComponent does NOT exist.
 * 3. Menu link:    Relative path (no leading slash), sync Component (not async)
 * 4. Router:       Relative path, sync Component
 *
 * @module strapi-plugin-env-sync/strapi-admin
 */

import { PLUGIN_ID, PLUGIN_ICON, Initializer, SyncButtonAction } from './admin/src/index';
import { LogsPage } from './admin/src/pages/LogsPage';

export default {

  register(app) {
    // ── Register plugin (runs Initializer on boot) ───────────────────────
    app.registerPlugin({
      id:          PLUGIN_ID,
      name:        PLUGIN_ID,
      initializer: Initializer,
    });

    // ── Menu link → Logs page ────────────────────────────────────────────
    // Component must be sync function returning { default: Component }
    // Path must be relative (no leading slash)
    app.addMenuLink({
      to:        'plugins/' + PLUGIN_ID,
      icon:      PLUGIN_ICON,
      intlLabel: {
        id:             PLUGIN_ID + '.menu.label',
        defaultMessage: 'Env Sync',
      },
      Component: () => ({ default: LogsPage }),
      permissions: [
        { action: 'plugin::' + PLUGIN_ID + '.view-logs', subject: null },
      ],
    });

    // ── Register route ───────────────────────────────────────────────────
    app.router.addRoute({
      path:      'plugins/' + PLUGIN_ID,
      exact:     true,
      Component: LogsPage,
    });
  },

  bootstrap(app) {
    // ── Register Sync Button as a DocumentAction in the edit view header ─
    //
    // This is the CORRECT Strapi v5 API. The content-manager plugin exposes:
    //   addDocumentAction  → renders in the edit view action panel or header
    //   addDocumentHeaderAction → renders in the header (top right area)
    //
    // We use addDocumentAction with position:'header' which is the
    // standard documented approach for v5.
    //
    const contentManager = app.getPlugin('content-manager');

    if (!contentManager) {
      console.warn('[env-sync] content-manager plugin not found — sync button will not appear.');
      return;
    }

    const apis = contentManager.apis;

    if (apis && typeof apis.addDocumentAction === 'function') {
      // Primary: addDocumentAction with position: 'header'
      apis.addDocumentAction([SyncButtonAction]);

    } else if (apis && typeof apis.addDocumentHeaderAction === 'function') {
      // Fallback for some v5 sub-versions that split header vs panel
      apis.addDocumentHeaderAction([SyncButtonAction]);

    } else {
      console.warn(
        '[env-sync] Could not register sync button — ' +
        'contentManager.apis.addDocumentAction not available. ' +
        'Strapi version: check that you are on v5.0.0+'
      );
    }
  },
};

/**
 * strapi-plugin-env-sync — Admin Entry Point (Strapi v5 compatible)
 *
 * Fixes applied:
 *  1. app.injectContentManagerComponent → app.getPlugin('content-manager').injectComponent()
 *  2. addMenuLink Component must be sync and return default export directly
 *  3. Router path must be relative (no leading slash matching parent route)
 *  4. addMenuLink uses sync Component, not async
 *
 * @module strapi-plugin-env-sync/strapi-admin
 */

import { PLUGIN_ID, PLUGIN_ICON, Initializer } from './admin/src/index';
import { SyncButton } from './admin/src/components/SyncButton';
import { LogsPage }   from './admin/src/pages/LogsPage';

export default {
  register(app) {
    // ── Register plugin (required for Initializer) ───────────────────────
    app.registerPlugin({
      id:          PLUGIN_ID,
      name:        PLUGIN_ID,
      initializer: Initializer,
    });

    // ── Add menu link → Logs page ────────────────────────────────────────
    // Component must be sync and return a default export (not async in v5)
    app.addMenuLink({
      to:        'plugins/' + PLUGIN_ID,   // relative path — no leading slash
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

    // ── Register the route inside the plugin panel ───────────────────────
    app.router.addRoute({
      path:      'plugins/' + PLUGIN_ID,   // relative — Strapi prepends /admin/
      exact:     true,
      Component: LogsPage,
    });
  },

  bootstrap(app) {
    // ── Inject Sync Button into Content Manager edit view ────────────────
    // In Strapi v5 the correct API is via the content-manager plugin object
    const contentManager = app.getPlugin('content-manager');

    if (contentManager && typeof contentManager.injectComponent === 'function') {
      // Strapi v5.x content-manager plugin API
      contentManager.injectComponent('editView', 'right-links', {
        name:      PLUGIN_ID + '-sync-button',
        Component: SyncButton,
      });
    } else if (typeof app.injectContentManagerComponent === 'function') {
      // Fallback for earlier v5 builds that still had this on app
      app.injectContentManagerComponent('editView', 'right-links', {
        name:      PLUGIN_ID + '-sync-button',
        Component: SyncButton,
      });
    } else {
      // Last resort — use the injection zones API if available
      console.warn(
        '[env-sync] Could not inject SyncButton — ' +
        'content-manager.injectComponent not available. ' +
        'Check your Strapi v5 version.'
      );
    }
  },
};

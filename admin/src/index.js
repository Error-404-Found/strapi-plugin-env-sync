/**
 * Admin panel index — exports constants and components used by strapi-admin.js
 *
 * @module env-sync/admin/src/index
 */

import React, { useEffect, useRef } from 'react';

export const PLUGIN_ID   = 'env-sync';
export const PLUGIN_ICON = 'refresh';

/**
 * Initializer — Strapi v5 requires this component to call setPlugin(pluginId)
 * once the plugin is ready. It renders nothing.
 *
 * @param {{ setPlugin: function }} props
 */
export function Initializer({ setPlugin }) {
  const ref = useRef(setPlugin);

  useEffect(() => {
    ref.current(PLUGIN_ID);
  }, []);

  return null;
}

export { SyncButton } from './components/SyncButton';
export { LogsPage }   from './pages/LogsPage';

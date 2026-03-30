/**
 * Admin panel index — exports constants and components used by strapi-admin.js
 *
 * @module env-sync/admin/src/index
 */

import React, { useEffect, useRef } from 'react';

export const PLUGIN_ID   = 'env-sync';
export const PLUGIN_ICON = 'ArrowsCounterClockwise';

/**
 * Initializer — signals plugin readiness to Strapi.
 * Must call setPlugin(id) exactly once, inside useEffect.
 */
export function Initializer({ setPlugin }) {
  const ref = useRef(setPlugin);
  useEffect(() => { ref.current(PLUGIN_ID); }, []);
  return null;
}

export { SyncButtonAction } from './components/SyncButton';
export { LogsPage }         from './pages/LogsPage';

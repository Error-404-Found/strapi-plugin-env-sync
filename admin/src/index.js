/**
 * Admin panel index
 * @module env-sync/admin/src/index
 */

import React, { useEffect, useRef } from 'react';
import { ArrowsCounterClockwise } from '@strapi/icons';

export const PLUGIN_ID = 'env-sync';

/**
 * The icon component — passed directly to addMenuLink.
 * Strapi v5 addMenuLink accepts a React component for the icon field.
 */
export const PLUGIN_ICON = ArrowsCounterClockwise;

/**
 * Initializer — signals plugin readiness to Strapi.
 */
export function Initializer({ setPlugin }) {
  const ref = useRef(setPlugin);
  useEffect(() => { ref.current(PLUGIN_ID); }, []);
  return null;
}

export { SyncButtonAction } from './components/SyncButton';
export { LogsPage }         from './pages/LogsPage';

/**
 * usePluginConfig — fetches and caches plugin config from the server.
 *
 * Uses React state + useEffect so it works correctly inside any
 * React component including Strapi modal content renderers.
 * No module-level cache that could get stuck in a bad state.
 *
 * @module env-sync/admin/src/hooks/usePluginConfig
 */

import { useState, useEffect } from 'react';
import { api } from '../utils/api';

/**
 * Returns { config, loading, error }
 *
 * config shape:
 * {
 *   currentEnv:       'SIT' | 'QA' | 'UAT' | 'PROD',
 *   targets:          string[],   // e.g. ['QA']
 *   conflictStrategy: string,
 *   enableDryRun:     boolean,
 *   enableRollback:   boolean,
 *   perContentType:   object,
 * }
 */
export function usePluginConfig() {
  const [config,  setConfig]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    let cancelled = false;

    api.getConfig()
      .then((data) => {
        if (!cancelled) {
          setConfig(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, []);

  return { config, loading, error };
}

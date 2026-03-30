/**
 * SyncButton — injected into the Content Manager edit view right-links zone.
 *
 * Reads current env + targets from plugin config and renders the appropriate button.
 * Hidden on QA and PROD (no outbound sync configured from those envs).
 *
 * @module env-sync/admin/src/components/SyncButton
 */

import React, { useState, useEffect } from 'react';
import { Button, Tooltip, Flex, Badge, Loader } from '@strapi/design-system';
import { Refresh, Lock } from '@strapi/icons';
import { usePluginConfig } from '../../hooks/usePluginConfig';
import { SyncModal } from '../SyncModal';
import { api } from '../../utils/api';

/** Colour theme per target env badge */
const ENV_BADGE = {
  QA:   { bg: 'warning100', text: 'warning700' },
  PROD: { bg: 'danger100',  text: 'danger700'  },
  UAT:  { bg: 'primary100', text: 'primary700' },
  SIT:  { bg: 'neutral100', text: 'neutral700' },
};

/**
 * Strapi injects this component with no props in v5.
 * We read contentType + documentId from the URL.
 */
export function SyncButton() {
  const { config, loading: configLoading } = usePluginConfig();
  const [modalOpen,    setModalOpen]    = useState(false);
  const [targetStatus, setTargetStatus] = useState({});
  const [statusLoading, setStatusLoading] = useState(false);

  // Parse contentType + documentId from the current URL
  const { contentType, documentId } = _parseLocationInfo();

  // Load health status on mount
  useEffect(() => {
    if (!config?.targets?.length) return;
    setStatusLoading(true);
    api.getStatus()
      .then((res) => setTargetStatus(res.targets || {}))
      .catch(() => {})
      .finally(() => setStatusLoading(false));
  }, [config]);

  if (configLoading) return null;
  if (!config)       return null;

  const { currentEnv, targets = [], enableDryRun, conflictStrategy } = config;

  // No outbound targets configured for this env → hide button entirely
  if (!targets || targets.length === 0) return null;

  // QA and PROD should not push (only SIT→QA and UAT→PROD are valid flows)
  if (currentEnv === 'QA' || currentEnv === 'PROD') {
    return (
      <Tooltip description={'Sync is not available from the ' + currentEnv + ' environment.'}>
        <Button variant="secondary" size="S" disabled startIcon={<Lock />}>
          Env Sync (disabled)
        </Button>
      </Tooltip>
    );
  }

  if (!contentType || !documentId) return null;

  // Build one button per target env
  return (
    <>
      <Flex gap={2} alignItems="center">
        {targets.map((targetEnv) => {
          const health     = targetStatus[targetEnv];
          const isHealthy  = !health || health.status === 'reachable' || health.status === 'unknown';
          const badge      = ENV_BADGE[targetEnv] || ENV_BADGE.SIT;
          const label      = 'Sync → ' + targetEnv;

          return (
            <Tooltip
              key={targetEnv}
              description={
                health?.status === 'unreachable' ? targetEnv + ' is currently unreachable' :
                health?.status === 'timeout'     ? targetEnv + ' timed out' :
                'Sync this document to ' + targetEnv
              }
            >
              <Button
                variant="secondary"
                size="S"
                startIcon={statusLoading ? <Loader small /> : <Refresh />}
                onClick={() => setModalOpen(targetEnv)}
                disabled={!isHealthy}
              >
                {label}
                {health?.status === 'reachable' && (
                  <Badge
                    marginLeft={1}
                    backgroundColor={badge.bg}
                    textColor={badge.text}
                    style={{ fontSize: '9px', padding: '1px 4px' }}
                  >
                    {health.latencyMs}ms
                  </Badge>
                )}
              </Button>
            </Tooltip>
          );
        })}
      </Flex>

      {/* One modal per target (only one open at a time) */}
      {targets.map((targetEnv) => (
        <SyncModal
          key={targetEnv}
          isOpen={modalOpen === targetEnv}
          onClose={() => setModalOpen(false)}
          contentType={contentType}
          documentId={documentId}
          targetEnv={targetEnv}
          defaultStrategy={config.perContentType?.[contentType]?.conflictStrategy || conflictStrategy}
          enableDryRun={enableDryRun}
          onSuccess={() => {
            setModalOpen(false);
            // Refresh health after successful sync
            api.getStatus().then((res) => setTargetStatus(res.targets || {})).catch(() => {});
          }}
        />
      ))}
    </>
  );
}

// ─── Private ──────────────────────────────────────────────────────────────────

/**
 * Parse the content type UID and documentId from the current admin URL.
 * Strapi v5 Content Manager URLs follow the pattern:
 *   /admin/content-manager/collection-types/api::article.article/{documentId}
 *   /admin/content-manager/single-types/api::homepage.homepage
 *
 * @returns {{ contentType: string|null, documentId: string|null }}
 */
function _parseLocationInfo() {
  try {
    const pathname = window.location.pathname;

    // Collection type
    let match = pathname.match(/\/content-manager\/collection-types\/([^/]+)\/([^/]+)/);
    if (match) return { contentType: decodeURIComponent(match[1]), documentId: match[2] };

    // Single type
    match = pathname.match(/\/content-manager\/single-types\/([^/]+)/);
    if (match) return { contentType: decodeURIComponent(match[1]), documentId: '__single__' };

    return { contentType: null, documentId: null };
  } catch {
    return { contentType: null, documentId: null };
  }
}

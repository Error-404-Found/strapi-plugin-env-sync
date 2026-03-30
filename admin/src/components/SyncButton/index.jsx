/**
 * SyncButton — Strapi v5 DocumentActionComponent.
 *
 * SyncButtonAction is called by Strapi's content-manager with EditViewContext:
 *   { model, documentId, collectionType, document, meta, activeTab }
 *
 * It must return a DocumentActionDescription object (plain object, NOT JSX).
 * React hooks cannot be used directly inside SyncButtonAction — they belong
 * in the dialog.content component which IS a proper React component.
 *
 * @module env-sync/admin/src/components/SyncButton
 */

import React, { useState, useEffect } from 'react';
import { usePluginConfig }  from '../../hooks/usePluginConfig';
import { SyncModal }        from '../SyncModal';
import { api }              from '../../utils/api';

// ─── DocumentActionComponent (registered with addDocumentAction) ──────────────

/**
 * Returned to Strapi as a DocumentActionDescription.
 * Strapi calls this function on every render of the edit view.
 *
 * @param {{ model: string, documentId?: string, collectionType: string }} props
 * @returns {import('@strapi/content-manager').DocumentActionDescription}
 */
export function SyncButtonAction({ model, documentId, collectionType }) {
  return {
    label:    'Env Sync',
    icon:     React.createElement(SyncIcon),
    position: 'header',
    dialog: {
      type:    'modal',
      title:   'Environment Sync',
      content: ({ onClose }) =>
        React.createElement(SyncButtonContent, {
          model,
          documentId,
          collectionType,
          onClose,
        }),
    },
  };
}

// ─── Modal content (full React component — hooks are fine here) ───────────────

function SyncButtonContent({ model, documentId, collectionType, onClose }) {
  const { config, loading, error } = usePluginConfig();
  const [activeTarget,  setActiveTarget]  = useState(null);
  const [targetStatus,  setTargetStatus]  = useState({});
  const [statusLoading, setStatusLoading] = useState(false);

  // Load health status once config is available
  useEffect(() => {
    if (!config?.targets?.length) return;
    setStatusLoading(true);
    api.getStatus()
      .then((res) => setTargetStatus(res?.targets || {}))
      .catch(() => {})
      .finally(() => setStatusLoading(false));
  }, [config]);

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return React.createElement(
      'div',
      { style: styles.center },
      React.createElement('div', { style: styles.spinner }),
      React.createElement('p', { style: { marginTop: '12px', color: '#666' } }, 'Loading config…')
    );
  }

  if (error) {
    return React.createElement(
      'div',
      { style: { padding: '24px' } },
      React.createElement('div', { style: styles.errorBox },
        React.createElement('strong', null, '⚠ Could not load plugin config'),
        React.createElement('p', { style: { margin: '4px 0 0', fontSize: '13px' } }, error),
        React.createElement('p', { style: { margin: '8px 0 0', fontSize: '12px', color: '#888' } },
          'Make sure env-sync is configured in config/plugins.js and the server has restarted.'
        )
      )
    );
  }

  if (!config) return null;

  const { currentEnv, targets, enableDryRun, conflictStrategy } = config;

  // ── Guard: QA and PROD don't push ────────────────────────────────────────

  if (currentEnv === 'QA' || currentEnv === 'PROD') {
    return React.createElement(
      'div', { style: { padding: '24px', textAlign: 'center' } },
      React.createElement('p', { style: { color: '#666', marginBottom: '8px' } },
        '🔒 Env Sync is disabled on ' + currentEnv
      ),
      React.createElement('p', { style: { fontSize: '12px', color: '#999' } },
        currentEnv === 'QA'
          ? 'QA and UAT share the same database — no sync needed.'
          : 'PROD is the final destination — syncing out is not supported.'
      )
    );
  }

  // ── Guard: no targets in config ───────────────────────────────────────────

  if (!targets || targets.length === 0) {
    return React.createElement(
      'div', { style: { padding: '24px' } },
      React.createElement('div', { style: styles.warningBox },
        React.createElement('strong', null, 'No sync targets configured'),
        React.createElement('p', { style: { margin: '8px 0 0', fontSize: '13px' } },
          'Add targets to your env-sync config in ',
          React.createElement('code', null, 'config/plugins.js'),
          ':'
        ),
        React.createElement('pre', { style: styles.codeBlock },
          "targets: {\n  QA: {\n    url: 'https://qa.example.com',\n    secret: process.env.ENV_SYNC_QA_SECRET,\n  }\n}"
        ),
        React.createElement('p', { style: { margin: '8px 0 0', fontSize: '12px', color: '#888' } },
          'Current env: ' + (currentEnv || '(not set — check currentEnv in config)')
        )
      )
    );
  }

  // ── Guard: new document (no documentId yet) ───────────────────────────────

  if (!documentId || documentId === 'create') {
    return React.createElement(
      'div', { style: { padding: '24px', textAlign: 'center' } },
      React.createElement('p', { style: { color: '#666' } },
        '💾 Save the document first before syncing.'
      )
    );
  }

  // ── Active sync modal ─────────────────────────────────────────────────────

  if (activeTarget) {
    return React.createElement(SyncModal, {
      onClose:         () => setActiveTarget(null),
      contentType:     model,
      documentId,
      targetEnv:       activeTarget,
      defaultStrategy: config.perContentType?.[model]?.conflictStrategy || conflictStrategy || 'source-wins',
      enableDryRun:    enableDryRun !== false,
      onSuccess:       () => { setActiveTarget(null); onClose(); },
    });
  }

  // ── Target selection ──────────────────────────────────────────────────────

  return React.createElement(
    'div', { style: { padding: '20px', minWidth: '360px' } },

    React.createElement('div', { style: styles.metaRow },
      React.createElement('span', { style: styles.metaLabel }, 'Content type'),
      React.createElement('code', { style: styles.metaValue },
        model?.split('.').pop() || model
      )
    ),
    React.createElement('div', { style: styles.metaRow },
      React.createElement('span', { style: styles.metaLabel }, 'Document ID'),
      React.createElement('code', { style: styles.metaValue },
        documentId?.slice(0, 16) + '…'
      )
    ),
    React.createElement('div', { style: styles.metaRow },
      React.createElement('span', { style: styles.metaLabel }, 'Source env'),
      React.createElement('span', { style: styles.envBadge(currentEnv) }, currentEnv)
    ),

    React.createElement('hr', { style: { border: 'none', borderTop: '1px solid #eee', margin: '16px 0' } }),

    React.createElement('p', { style: { fontWeight: 600, marginBottom: '12px', color: '#32324d' } },
      'Select target environment:'
    ),

    React.createElement(
      'div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
      targets.map((targetEnv) => {
        const health    = targetStatus[targetEnv];
        const isHealthy = !health || health.status === 'reachable' || health.status === 'unknown';
        const badge     = health?.status === 'reachable'   ? ' ✓ ' + health.latencyMs + 'ms'  :
                          health?.status === 'unreachable' ? ' ✗ Unreachable'                  :
                          health?.status === 'timeout'     ? ' ✗ Timeout'                      :
                          statusLoading                    ? ' …'                               : '';

        return React.createElement(
          'button',
          {
            key:      targetEnv,
            onClick:  () => isHealthy && setActiveTarget(targetEnv),
            disabled: !isHealthy,
            style:    styles.targetButton(isHealthy),
          },
          React.createElement('span', null, '↑ Sync → ' + targetEnv),
          badge && React.createElement('span', { style: { fontSize: '11px', opacity: 0.75 } }, badge)
        );
      })
    )
  );
}

// ─── Sync icon SVG ────────────────────────────────────────────────────────────

function SyncIcon() {
  return React.createElement(
    'svg',
    { xmlns: 'http://www.w3.org/2000/svg', width: 16, height: 16, viewBox: '0 0 256 256', fill: 'currentColor' },
    React.createElement('path', {
      d: 'M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h31.39L182.06,70.63A80,80,0,1,0,202.7,172a8,8,0,1,1,13.85,8A96,96,0,1,1,165.94,50.74L184,68.6V48a8,8,0,0,1,16,0Z',
    })
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  center: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '32px',
  },
  spinner: {
    width: '24px', height: '24px',
    border: '3px solid #eee',
    borderTop: '3px solid #4945ff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorBox: {
    background: '#fce4e4', border: '1px solid #f5c0be',
    borderRadius: '6px', padding: '12px 16px', color: '#d02b20',
  },
  warningBox: {
    background: '#fdf4dc', border: '1px solid #f5d178',
    borderRadius: '6px', padding: '12px 16px', color: '#8e6a00',
  },
  codeBlock: {
    background: '#f0f0f5', borderRadius: '4px',
    padding: '8px 12px', fontSize: '12px',
    fontFamily: 'monospace', margin: '8px 0 0',
    whiteSpace: 'pre-wrap',
  },
  metaRow: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: '6px', fontSize: '13px',
  },
  metaLabel: { color: '#666', fontWeight: 500 },
  metaValue: {
    background: '#f0f0f5', borderRadius: '3px',
    padding: '1px 6px', fontSize: '11px', fontFamily: 'monospace',
  },
  envBadge: (env) => ({
    background: env === 'SIT' ? '#e0e8ff' : env === 'UAT' ? '#e0f5e9' : '#f0f0f5',
    color:      env === 'SIT' ? '#3050c8' : env === 'UAT' ? '#1e7e34' : '#444',
    borderRadius: '10px', padding: '2px 10px',
    fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px',
  }),
  targetButton: (isHealthy) => ({
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 16px', width: '100%',
    background:   isHealthy ? '#4945ff' : '#dde0eb',
    color:        isHealthy ? '#fff'    : '#8e8ea9',
    border:       'none', borderRadius: '6px',
    cursor:       isHealthy ? 'pointer' : 'not-allowed',
    fontWeight:   600, fontSize: '14px',
    transition:   'background 0.15s',
  }),
};

/**
 * SyncButton — used as a Strapi v5 DocumentAction rendered in the edit view header.
 *
 * This is NOT a standalone React component injected via injectComponent.
 * Instead it is registered via:
 *   contentManager.apis.addDocumentAction([SyncButtonAction])
 *
 * Strapi v5 calls the component function with EditViewContext props:
 *   { model, documentId, collectionType, document, meta, activeTab }
 *
 * The function must return a DocumentActionDescription object (NOT JSX).
 *
 * @module env-sync/admin/src/components/SyncButton
 */

import React, { useState, useEffect } from 'react';
import { usePluginConfig } from '../../hooks/usePluginConfig';
import { SyncModal }       from '../SyncModal';
import { api }             from '../../utils/api';

/**
 * SyncButtonAction — DocumentActionComponent for Strapi v5 content-manager.
 *
 * Called by Strapi with EditViewContext. Returns a DocumentActionDescription.
 *
 * @param {object} props
 * @param {string}  props.model          - Content type UID (e.g. api::article.article)
 * @param {string}  [props.documentId]   - undefined when creating a new entry
 * @param {string}  props.collectionType - 'collection-types' | 'single-types'
 */
export function SyncButtonAction({ model, documentId, collectionType }) {
  // This function is called per-render by Strapi — it must return
  // a DocumentActionDescription (plain object, not JSX).
  // We use a wrapper component to manage state and modal rendering.
  return {
    label:    'Env Sync',
    icon:     React.createElement(SyncIcon),
    position: 'header',
    // Render a custom modal instead of using Strapi's built-in dialog
    // by returning a modal type dialog
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

// ─── Internal Components ───────────────────────────────────────────────────────

/**
 * The actual sync UI rendered inside Strapi's modal shell.
 * Has access to plugin config and renders per-target sync buttons.
 */
function SyncButtonContent({ model, documentId, collectionType, onClose }) {
  const { config, loading, error } = usePluginConfig();
  const [activeTarget, setActiveTarget]   = useState(null);
  const [targetStatus, setTargetStatus]   = useState({});

  useEffect(() => {
    if (!config?.targets?.length) return;
    api.getStatus()
      .then((res) => setTargetStatus(res.targets || {}))
      .catch(() => {});
  }, [config]);

  if (loading) {
    return React.createElement('div', { style: { padding: '16px', textAlign: 'center' } },
      'Loading config…'
    );
  }

  if (error) {
    return React.createElement('div', { style: { padding: '16px', color: '#d02b20' } },
      'Failed to load plugin config: ' + error
    );
  }

  if (!config) return null;

  const { currentEnv, targets = [], enableDryRun, conflictStrategy } = config;

  // QA/PROD don't push
  if (currentEnv === 'QA' || currentEnv === 'PROD') {
    return React.createElement('div', {
      style: { padding: '24px', textAlign: 'center', color: '#666' }
    }, 'Env Sync is not available from the ' + currentEnv + ' environment.');
  }

  if (!targets || targets.length === 0) {
    return React.createElement('div', {
      style: { padding: '24px', textAlign: 'center', color: '#666' }
    }, 'No sync targets configured for ' + currentEnv + '.');
  }

  if (!documentId) {
    return React.createElement('div', {
      style: { padding: '24px', textAlign: 'center', color: '#666' }
    }, 'Save the document before syncing.');
  }

  // Show target selection if no active target, otherwise show SyncModal
  if (activeTarget) {
    return React.createElement(SyncModal, {
      isOpen:          true,
      onClose:         () => { setActiveTarget(null); onClose(); },
      contentType:     model,
      documentId,
      targetEnv:       activeTarget,
      defaultStrategy: config.perContentType?.[model]?.conflictStrategy || conflictStrategy,
      enableDryRun,
      onSuccess:       () => { setActiveTarget(null); onClose(); },
    });
  }

  return React.createElement('div', { style: { padding: '16px' } },
    React.createElement('p', {
      style: { marginBottom: '16px', color: '#32324d', fontWeight: 500 }
    }, 'Select a target environment to sync ' + (model?.split('.').pop() || model) + ':'),

    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
      targets.map((targetEnv) => {
        const health    = targetStatus[targetEnv];
        const isHealthy = !health || health.status === 'reachable' || health.status === 'unknown';
        const latency   = health?.status === 'reachable' ? ' (' + health.latencyMs + 'ms)' : '';
        const statusMsg =
          health?.status === 'unreachable' ? ' ⚠ Unreachable' :
          health?.status === 'timeout'     ? ' ⚠ Timeout'     : latency;

        return React.createElement('button', {
          key:      targetEnv,
          onClick:  () => isHealthy && setActiveTarget(targetEnv),
          disabled: !isHealthy,
          style: {
            padding:         '10px 16px',
            background:      isHealthy ? '#4945ff' : '#dde0eb',
            color:           isHealthy ? '#fff' : '#666',
            border:          'none',
            borderRadius:    '4px',
            cursor:          isHealthy ? 'pointer' : 'not-allowed',
            fontWeight:      600,
            fontSize:        '14px',
            textAlign:       'left',
            display:         'flex',
            justifyContent:  'space-between',
            alignItems:      'center',
          },
        },
          React.createElement('span', null, '↑ Sync → ' + targetEnv),
          React.createElement('span', {
            style: { fontSize: '12px', opacity: 0.8 }
          }, statusMsg)
        );
      })
    )
  );
}

/** Simple SVG sync icon */
function SyncIcon() {
  return React.createElement('svg', {
    xmlns:   'http://www.w3.org/2000/svg',
    width:   '16',
    height:  '16',
    viewBox: '0 0 256 256',
    fill:    'currentColor',
  },
    React.createElement('path', {
      d: 'M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h31.39L182.06,70.63A80,80,0,1,0,202.7,172a8,8,0,1,1,13.85,8A96,96,0,1,1,165.94,50.74L184,68.6V48a8,8,0,0,1,16,0Z'
    })
  );
}

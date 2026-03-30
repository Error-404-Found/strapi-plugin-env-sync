/**
 * SyncModal — the inner sync workflow UI.
 *
 * This component is rendered INSIDE Strapi's modal shell (provided by
 * the DocumentAction dialog: { type: 'modal' } configuration).
 * It must NOT render its own Modal.Root — it just renders content directly.
 *
 * Workflow:
 *   Step 1 (CONFIRM):    Choose conflict strategy, optionally preview diff
 *   Step 2 (DIFFING):    Dry-run in progress
 *   Step 3 (DIFF_READY): Show diff, confirm or go back
 *   Step 4 (SYNCING):    Sync in progress
 *   Step 5 (DONE):       Result
 *
 * @module env-sync/admin/src/components/SyncModal
 */

import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Flex, Button, Loader,
  SingleSelect, SingleSelectOption,
} from '@strapi/design-system';
import { DiffViewer } from '../DiffViewer';
import { api }        from '../../utils/api';

const STEPS = {
  CONFIRM:    'CONFIRM',
  DIFFING:    'DIFFING',
  DIFF_READY: 'DIFF_READY',
  SYNCING:    'SYNCING',
  DONE:       'DONE',
};

const STRATEGY_OPTIONS = [
  { value: 'source-wins', label: 'Source wins (overwrite target)' },
  { value: 'target-wins', label: 'Target wins (skip if target is newer)' },
  { value: 'manual',      label: 'Manual (block and notify)' },
];

/**
 * @param {object}   props
 * @param {boolean}  props.isOpen          - ignored here (parent controls visibility)
 * @param {function} props.onClose         - close the modal
 * @param {string}   props.contentType     - Strapi UID
 * @param {string}   props.documentId
 * @param {string}   props.targetEnv
 * @param {string}   props.defaultStrategy
 * @param {boolean}  props.enableDryRun
 * @param {function} props.onSuccess
 */
export function SyncModal({
  onClose,
  contentType,
  documentId,
  targetEnv,
  defaultStrategy = 'source-wins',
  enableDryRun    = true,
  onSuccess,
}) {
  const [step,     setStep]     = useState(STEPS.CONFIRM);
  const [diff,     setDiff]     = useState(null);
  const [strategy, setStrategy] = useState(defaultStrategy);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState(null);

  const reset = useCallback(() => {
    setStep(STEPS.CONFIRM);
    setDiff(null);
    setResult(null);
    setError(null);
    setStrategy(defaultStrategy);
  }, [defaultStrategy]);

  const handlePreview = useCallback(async () => {
    setStep(STEPS.DIFFING);
    setError(null);
    try {
      const res = await api.triggerSync({
        contentType, documentId, targetEnv,
        locale: null, isDryRun: true,
        conflictStrategyOverride: strategy,
      });
      setDiff(res.diff);
      setStep(STEPS.DIFF_READY);
    } catch (err) {
      setError(err.message);
      setStep(STEPS.CONFIRM);
    }
  }, [contentType, documentId, targetEnv, strategy]);

  const handleSync = useCallback(async () => {
    setStep(STEPS.SYNCING);
    setError(null);
    try {
      const res = await api.triggerSync({
        contentType, documentId, targetEnv,
        locale: null, isDryRun: false,
        conflictStrategyOverride: strategy,
      });
      setResult(res);
      setStep(STEPS.DONE);
      if (res.success) onSuccess?.(res);
    } catch (err) {
      setError(err.message);
      setStep(STEPS.DIFF_READY);
    }
  }, [contentType, documentId, targetEnv, strategy, onSuccess]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box padding={4} style={{ minWidth: '480px' }}>

      {/* CONFIRM */}
      {step === STEPS.CONFIRM && (
        <Box>
          <Typography variant="omega" marginBottom={4} display="block">
            Sync <strong>{contentType?.split('.').pop()}</strong>{' '}
            <code style={{ fontSize: '11px', background: '#f0f0ff', padding: '2px 6px', borderRadius: '3px' }}>
              {documentId?.slice(0, 12)}…
            </code>{' '}
            to <strong>{targetEnv}</strong>.
          </Typography>

          <Box marginBottom={4}>
            <Typography variant="pi" textColor="neutral600" marginBottom={1} display="block">
              Conflict resolution strategy
            </Typography>
            <SingleSelect value={strategy} onChange={setStrategy}>
              {STRATEGY_OPTIONS.map((o) => (
                <SingleSelectOption key={o.value} value={o.value}>{o.label}</SingleSelectOption>
              ))}
            </SingleSelect>
          </Box>

          {error && (
            <Box padding={3} background="danger100" borderRadius="4px" marginBottom={4}>
              <Typography variant="pi" textColor="danger600">{error}</Typography>
            </Box>
          )}

          <Flex gap={2} justifyContent="flex-end">
            <Button variant="tertiary" onClick={onClose}>Cancel</Button>
            {enableDryRun && (
              <Button variant="secondary" onClick={handlePreview}>Preview diff</Button>
            )}
            <Button variant="danger-light" onClick={handleSync}>
              Sync to {targetEnv}
            </Button>
          </Flex>
        </Box>
      )}

      {/* DIFFING */}
      {step === STEPS.DIFFING && (
        <Flex justifyContent="center" padding={8} direction="column" alignItems="center" gap={3}>
          <Loader />
          <Typography variant="omega" textColor="neutral600">Computing diff…</Typography>
        </Flex>
      )}

      {/* DIFF_READY */}
      {step === STEPS.DIFF_READY && (
        <Box>
          <Typography variant="omega" marginBottom={4} display="block">
            Changes that will be applied to <strong>{targetEnv}</strong>:
          </Typography>
          <Box marginBottom={4}>
            <DiffViewer diff={diff} />
          </Box>
          {error && (
            <Box padding={3} background="danger100" borderRadius="4px" marginBottom={4}>
              <Typography variant="pi" textColor="danger600">{error}</Typography>
            </Box>
          )}
          <Flex gap={2} justifyContent="flex-end">
            <Button variant="tertiary" onClick={onClose}>Cancel</Button>
            <Button variant="secondary" onClick={reset}>Back</Button>
            <Button
              variant="danger-light"
              onClick={handleSync}
              disabled={diff && !diff.hasChanges}
            >
              {diff && !diff.hasChanges ? 'No changes to sync' : 'Confirm & Sync'}
            </Button>
          </Flex>
        </Box>
      )}

      {/* SYNCING */}
      {step === STEPS.SYNCING && (
        <Flex justifyContent="center" padding={8} direction="column" alignItems="center" gap={3}>
          <Loader />
          <Typography variant="omega" textColor="neutral600">
            Syncing to {targetEnv}…
          </Typography>
        </Flex>
      )}

      {/* DONE */}
      {step === STEPS.DONE && result && (
        <Box>
          <Box
            padding={4}
            background={result.success ? 'success100' : 'danger100'}
            borderRadius="4px"
            marginBottom={4}
          >
            <Typography
              variant="omega"
              textColor={result.success ? 'success600' : 'danger600'}
            >
              {result.success
                ? '✓ Synced successfully to ' + targetEnv + '! ' +
                  (result.diff?.fieldsChanged?.length || 0) + ' field(s) updated.' +
                  (result.snapshotId ? ' Rollback snapshot saved.' : '')
                : '✗ Sync failed: ' + result.message
              }
            </Typography>
          </Box>
          {result.success && result.diff && (
            <Box marginBottom={4}>
              <DiffViewer diff={result.diff} />
            </Box>
          )}
          <Flex justifyContent="flex-end">
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </Flex>
        </Box>
      )}

    </Box>
  );
}

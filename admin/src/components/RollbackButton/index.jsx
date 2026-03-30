/**
 * RollbackButton — shown in the Logs page against each successful sync entry.
 * Confirms then triggers rollback via the API.
 *
 * @module env-sync/admin/src/components/RollbackButton
 */

import React, { useState } from 'react';
import {
  Button, Dialog, DialogBody, DialogFooter,
  Typography, Flex, Loader,
} from '@strapi/design-system';
import { Refresh } from '@strapi/icons';
import { api } from '../../utils/api';

/**
 * @param {object} props
 * @param {string} props.snapshotId    - The snapshot documentId to restore
 * @param {string} props.contentType
 * @param {string} props.documentId
 * @param {function} props.onSuccess   - Called after successful rollback
 */
export function RollbackButton({ snapshotId, contentType, documentId, onSuccess }) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  if (!snapshotId) return null;

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.rollback(snapshotId);
      setOpen(false);
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="tertiary"
        size="S"
        startIcon={<Refresh />}
        onClick={() => setOpen(true)}
      >
        Rollback
      </Button>

      <Dialog onClose={() => !loading && setOpen(false)} title="Confirm Rollback" isOpen={open}>
        <DialogBody>
          <Flex direction="column" alignItems="center" gap={4}>
            {loading ? (
              <>
                <Loader small />
                <Typography variant="omega">Restoring…</Typography>
              </>
            ) : (
              <Typography variant="omega" textAlign="center">
                This will restore <strong>{contentType}</strong> (ID: <code>{documentId}</code>) to the state it was in before this sync.
                <br /><br />
                <strong>This cannot be undone.</strong>
              </Typography>
            )}
            {error && (
              <Typography variant="pi" textColor="danger600">{error}</Typography>
            )}
          </Flex>
        </DialogBody>
        <DialogFooter
          startAction={<Button variant="tertiary" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>}
          endAction={<Button variant="danger-light" onClick={handleConfirm} disabled={loading}>Yes, rollback</Button>}
        />
      </Dialog>
    </>
  );
}

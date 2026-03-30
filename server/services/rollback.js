'use strict';

/**
 * Rollback Service
 *
 * Snapshots a document before every sync write, and restores it on demand.
 *
 * NOTE: The schema field `syncDocumentId` stores the Strapi document's documentId.
 * `documentId` is a reserved Strapi v5 system field and cannot be used in schemas.
 *
 * @module env-sync/server/services/rollback
 */

const crypto = require('crypto');

const PLUGIN_ID    = 'env-sync';
const SNAPSHOT_UID = `plugin::${PLUGIN_ID}.env-sync-snapshot`;

module.exports = ({ strapi }) => ({

  /**
   * Take a snapshot of the current document before it is overwritten.
   *
   * @param {object} params
   * @param {string}  params.contentType
   * @param {string}  params.syncDocumentId  - The Strapi documentId of the content document
   * @param {string|null} params.locale
   * @param {string}  params.environment
   * @param {number}  params.takenByAdminId
   * @param {string}  params.logId
   * @returns {Promise<object|null>}
   */
  async takeSnapshot({ contentType, syncDocumentId, locale, environment, takenByAdminId, logId }) {
    const pluginConfig = strapi.config.get(`plugin::${PLUGIN_ID}`);
    if (!pluginConfig?.enableRollback) return null;

    // 1. Fetch current document (all locales)
    const snapshotData = await _fetchAllLocales(strapi, contentType, syncDocumentId);
    if (!snapshotData || Object.keys(snapshotData).length === 0) {
      strapi.log.debug(
        `[env-sync] rollback: ${contentType}#${syncDocumentId} not found — no snapshot taken`
      );
      return null;
    }

    // 2. Build media manifest
    const mediaSyncService = strapi.plugin(PLUGIN_ID).service('mediaSync');
    const mediaManifest    = mediaSyncService.buildMediaManifest(
      Object.values(snapshotData)[0] || {},
      contentType
    );

    // 3. Checksum + size
    const json      = JSON.stringify(snapshotData);
    const checksum  = crypto.createHash('sha256').update(json).digest('hex');
    const sizeBytes = Buffer.byteLength(json, 'utf8');

    // 4. Persist snapshot
    const snapshot = await strapi.documents(SNAPSHOT_UID).create({
      data: {
        contentType,
        syncDocumentId,
        locale:       locale ?? null,
        environment,
        snapshotData,
        mediaManifest,
        takenAt:     new Date().toISOString(),
        takenBy:     takenByAdminId ? { connect: [{ id: takenByAdminId }] } : undefined,
        logId,
        isRestored:  false,
        sizeBytes,
        checksum,
      },
    });

    strapi.log.debug(
      `[env-sync] rollback: snapshot ${snapshot.documentId} taken for ${contentType}#${syncDocumentId}`
    );

    // 5. Prune old snapshots
    await this._pruneOldSnapshots(
      contentType, syncDocumentId, environment,
      pluginConfig.maxSnapshotsPerDocument
    );

    return snapshot;
  },

  /**
   * Restore a document from a snapshot.
   *
   * @param {object} params
   * @param {string}  params.snapshotDocumentId  - The snapshot entry's own Strapi documentId
   * @param {number}  params.restoredByAdminId
   * @returns {Promise<object>}
   */
  async restoreSnapshot({ snapshotDocumentId, restoredByAdminId }) {
    // 1. Fetch snapshot entry
    const snapshot = await strapi.documents(SNAPSHOT_UID).findOne({
      documentId: snapshotDocumentId,
      populate:   ['takenBy'],
    });

    if (!snapshot) {
      return { success: false, message: `Snapshot "${snapshotDocumentId}" not found.` };
    }
    if (snapshot.isRestored) {
      return { success: false, message: 'This snapshot has already been restored.' };
    }

    // 2. Verify checksum
    const actualChecksum = crypto
      .createHash('sha256')
      .update(JSON.stringify(snapshot.snapshotData))
      .digest('hex');

    if (actualChecksum !== snapshot.checksum) {
      return {
        success: false,
        message: 'Snapshot integrity check failed (checksum mismatch). Data may be corrupted.',
      };
    }

    // 3. Restore each locale in a transaction
    await strapi.db.transaction(async () => {
      const { contentType, syncDocumentId, snapshotData } = snapshot;

      for (const [locale, data] of Object.entries(snapshotData)) {
        const isDefault = locale === '__default__';
        const cleanData = _stripMetaFields(data);

        const existing = isDefault
          ? await strapi.documents(contentType).findOne({ documentId: syncDocumentId })
          : await strapi.documents(contentType).findOne({ documentId: syncDocumentId, locale });

        if (existing) {
          await (isDefault
            ? strapi.documents(contentType).update({ documentId: syncDocumentId, data: cleanData })
            : strapi.documents(contentType).update({ documentId: syncDocumentId, locale, data: cleanData })
          );
        } else {
          await strapi.documents(contentType).create({
            data: { ...cleanData, documentId: syncDocumentId, ...(isDefault ? {} : { locale }) },
          });
        }

        // Restore publish state
        const publishOpts = isDefault
          ? { documentId: syncDocumentId }
          : { documentId: syncDocumentId, locale };

        if (data.publishedAt) {
          try { await strapi.documents(contentType).publish(publishOpts); } catch { /* ignore */ }
        } else {
          try { await strapi.documents(contentType).unpublish(publishOpts); } catch { /* already draft */ }
        }
      }
    });

    // 4. Mark snapshot as restored
    await strapi.documents(SNAPSHOT_UID).update({
      documentId: snapshotDocumentId,
      data: {
        isRestored:  true,
        restoredAt:  new Date().toISOString(),
        restoredBy:  restoredByAdminId ? { connect: [{ id: restoredByAdminId }] } : undefined,
      },
    });

    strapi.log.info(
      `[env-sync] rollback: restored ${snapshot.contentType}#${snapshot.syncDocumentId} ` +
      `from snapshot ${snapshotDocumentId}`
    );

    return {
      success:     true,
      message:     'Document restored successfully.',
      contentType: snapshot.contentType,
      documentId:  snapshot.syncDocumentId,
    };
  },

  /** Prune snapshots beyond maxCount — keeps the most recent N. */
  async _pruneOldSnapshots(contentType, syncDocumentId, environment, maxCount = 5) {
    try {
      const all = await strapi.documents(SNAPSHOT_UID).findMany({
        filters:    { contentType, syncDocumentId, environment },
        sort:       { takenAt: 'desc' },
        pagination: { page: 1, pageSize: 100 },
        fields:     ['documentId', 'takenAt'],
      });

      if (all.length <= maxCount) return;

      for (const snap of all.slice(maxCount)) {
        await strapi.documents(SNAPSHOT_UID).delete({ documentId: snap.documentId });
        strapi.log.debug(`[env-sync] rollback: pruned snapshot ${snap.documentId}`);
      }
    } catch (err) {
      strapi.log.warn(`[env-sync] rollback: pruning failed: ${err.message}`);
    }
  },
});

// ─── Private Helpers ──────────────────────────────────────────────────────────

async function _fetchAllLocales(strapi, contentType, syncDocumentId) {
  const schema = _getSchema(strapi, contentType);
  const isI18n = schema?.pluginOptions?.i18n?.localized === true;

  if (!isI18n) {
    const doc = await strapi.documents(contentType).findOne({
      documentId: syncDocumentId,
      populate:   '*',
    });
    if (!doc) return null;
    return { __default__: doc };
  }

  const localesService = strapi.plugin('i18n')?.service('locales');
  let locales = ['en'];
  if (localesService) {
    const all = await localesService.find();
    locales   = all.map((l) => l.code);
  }

  const result = {};
  for (const locale of locales) {
    try {
      const doc = await strapi.documents(contentType).findOne({
        documentId: syncDocumentId,
        locale,
        populate:   '*',
      });
      if (doc) result[locale] = doc;
    } catch { /* locale may not exist for this doc */ }
  }
  return Object.keys(result).length > 0 ? result : null;
}

function _getSchema(strapi, uid) {
  try { return strapi.getModel(uid); } catch { return null; }
}

function _stripMetaFields(data) {
  if (!data) return {};
  const { id, documentId, createdAt, updatedAt, publishedAt, createdBy, updatedBy, localizations, locale, ...rest } = data;
  return rest;
}

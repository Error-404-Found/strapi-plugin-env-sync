'use strict';

/**
 * Logger Service
 *
 * Handles all audit log creation, updates, and retrieval for env-sync operations.
 *
 * NOTE: The schema field storing the synced document's ID is named `syncDocumentId`
 * (not `documentId`) because `documentId` is a reserved system field in Strapi v5.
 * The variable `logDocumentId` refers to the log entry's own Strapi documentId.
 *
 * @module env-sync/server/services/logger
 */

const PLUGIN_ID = 'env-sync';
const LOG_UID   = `plugin::${PLUGIN_ID}.env-sync-log`;

function generateIdempotencyKey(syncDocId, targetEnv) {
  return `${syncDocId}:${targetEnv}:${Date.now()}`;
}

/**
 * @param {{ strapi: import('@strapi/strapi').Strapi }} context
 */
module.exports = ({ strapi }) => ({

  /**
   * Create a new log entry with status "pending".
   *
   * @param {object} params
   * @param {string}  params.contentType
   * @param {string}  params.syncDocumentId   - The synced document's documentId
   * @param {string|null} params.locale
   * @param {string}  params.sourceEnv
   * @param {string}  params.targetEnv
   * @param {string}  params.targetUrl
   * @param {number}  params.triggeredByAdminId
   * @param {string}  params.conflictStrategy
   * @param {boolean} params.isDryRun
   * @param {object|null} params.payload
   * @returns {Promise<object>} created log entry
   */
  async createLog({
    contentType,
    syncDocumentId,
    locale,
    sourceEnv,
    targetEnv,
    targetUrl,
    triggeredByAdminId,
    conflictStrategy,
    isDryRun = false,
    payload  = null,
  }) {
    const idempotencyKey = generateIdempotencyKey(syncDocumentId, targetEnv);

    const log = await strapi.documents(LOG_UID).create({
      data: {
        contentType,
        syncDocumentId,
        locale:          locale ?? null,
        sourceEnv,
        targetEnv,
        targetUrl,
        status:          'pending',
        conflictStrategy,
        isDryRun,
        payload:         payload ? _truncatePayload(payload) : null,
        triggeredBy:     triggeredByAdminId ? { connect: [{ id: triggeredByAdminId }] } : undefined,
        triggeredAt:     new Date().toISOString(),
        idempotencyKey,
        retryCount:      0,
      },
    });

    strapi.log.debug(
      `[env-sync] Log created: ${log.documentId} for ${contentType}#${syncDocumentId} → ${targetEnv}`
    );
    return log;
  },

  /** Mark in_progress */
  async markInProgress(logDocumentId) {
    return strapi.documents(LOG_UID).update({
      documentId: logDocumentId,
      data: { status: 'in_progress' },
    });
  },

  /** Mark success */
  async markSuccess(logDocumentId, { diffSummary, snapshotId, duration, retryCount }) {
    return strapi.documents(LOG_UID).update({
      documentId: logDocumentId,
      data: {
        status:       'success',
        diffSummary,
        snapshotId:   snapshotId ?? null,
        duration,
        retryCount:   retryCount ?? 0,
        completedAt:  new Date().toISOString(),
        errorMessage: null,
        errorStack:   null,
      },
    });
  },

  /** Mark failed */
  async markFailed(logDocumentId, { error, duration, retryCount }) {
    const isError   = error instanceof Error;
    const message   = isError ? error.message : String(error);
    const stack     = isError ? error.stack   : null;
    const isProd    = process.env.NODE_ENV === 'production';

    return strapi.documents(LOG_UID).update({
      documentId: logDocumentId,
      data: {
        status:       'failed',
        errorMessage: message,
        errorStack:   isProd ? null : stack,
        duration,
        retryCount:   retryCount ?? 0,
        completedAt:  new Date().toISOString(),
      },
    });
  },

  /** Mark dry_run */
  async markDryRun(logDocumentId, { diffSummary, duration }) {
    return strapi.documents(LOG_UID).update({
      documentId: logDocumentId,
      data: {
        status:      'dry_run',
        diffSummary,
        duration,
        completedAt: new Date().toISOString(),
      },
    });
  },

  /** Mark rolled_back */
  async markRolledBack(logDocumentId) {
    return strapi.documents(LOG_UID).update({
      documentId: logDocumentId,
      data: {
        status:      'rolled_back',
        completedAt: new Date().toISOString(),
      },
    });
  },

  /** Increment retry counter */
  async updateRetryCount(logDocumentId, retryCount) {
    return strapi.documents(LOG_UID).update({
      documentId: logDocumentId,
      data: { retryCount },
    });
  },

  /**
   * Retrieve paginated log entries.
   */
  async findLogs({ filters = {}, sort = { triggeredAt: 'desc' }, page = 1, pageSize = 25 } = {}) {
    return strapi.documents(LOG_UID).findMany({
      filters,
      sort,
      populate:   ['triggeredBy'],
      pagination: { page, pageSize },
    });
  },

  /** Retrieve a single log entry by its own documentId (the log's Strapi ID). */
  async findLog(logDocumentId) {
    return strapi.documents(LOG_UID).findOne({
      documentId: logDocumentId,
      populate:   ['triggeredBy'],
    });
  },

  /** Count log entries. */
  async countLogs(filters = {}) {
    return strapi.documents(LOG_UID).count({ filters });
  },

  /**
   * Check if a sync is already in progress for a given content document → target env.
   *
   * @param {string} syncDocumentId  - The synced document's documentId
   * @param {string} targetEnv
   */
  async isAlreadyInProgress(syncDocumentId, targetEnv) {
    const count = await strapi.documents(LOG_UID).count({
      filters: {
        syncDocumentId,
        targetEnv,
        status: { $in: ['pending', 'in_progress'] },
      },
    });
    return count > 0;
  },

  /** Export logs as flat array for CSV. */
  async exportLogs(filters = {}) {
    const logs = await strapi.documents(LOG_UID).findMany({
      filters,
      sort:       { triggeredAt: 'desc' },
      populate:   ['triggeredBy'],
      pagination: { page: 1, pageSize: 10_000 },
    });

    return logs.map((log) => ({
      logDocumentId:    log.documentId,
      syncDocumentId:   log.syncDocumentId,
      contentType:      log.contentType,
      sourceEnv:        log.sourceEnv,
      targetEnv:        log.targetEnv,
      status:           log.status,
      isDryRun:         log.isDryRun,
      conflictStrategy: log.conflictStrategy,
      locale:           log.locale ?? '',
      triggeredBy:      log.triggeredBy
        ? `${log.triggeredBy.firstname} ${log.triggeredBy.lastname} <${log.triggeredBy.email}>`
        : 'unknown',
      triggeredAt:      log.triggeredAt,
      completedAt:      log.completedAt ?? '',
      duration:         log.duration != null ? `${log.duration}ms` : '',
      retryCount:       log.retryCount,
      errorMessage:     log.errorMessage ?? '',
      fieldsChanged:    log.diffSummary?.fieldsChanged?.join(', ') ?? '',
      mediaReuploaded:  log.diffSummary?.mediaReuploaded?.length ?? 0,
      localesSynced:    log.diffSummary?.localesSynced?.join(', ') ?? '',
    }));
  },
});

function _truncatePayload(payload) {
  try {
    const json = JSON.stringify(payload);
    if (json.length <= 524_288) return payload;
    return { _truncated: true, _originalSize: json.length, preview: json.slice(0, 1000) };
  } catch {
    return { _truncationError: true };
  }
}

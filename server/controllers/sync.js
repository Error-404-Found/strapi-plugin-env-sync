'use strict';

/**
 * Sync Controller — Outbound
 * @module env-sync/server/controllers/sync
 */

const PLUGIN_ID = 'env-sync';

module.exports = {

  /**
   * POST /trigger
   */
  async trigger(ctx) {
    const adminUser = ctx.state.admin;
    const {
      contentType,
      documentId,
      targetEnv,
      locale                   = null,
      isDryRun                 = false,
      conflictStrategyOverride,
    } = ctx.request.body || {};

    const validationError = _validateTriggerInput({ contentType, documentId, targetEnv });
    if (validationError) return ctx.badRequest(validationError);

    const pluginConfig = strapi.config.get('plugin::' + PLUGIN_ID) || {};

    if (!pluginConfig.targets || !pluginConfig.targets[targetEnv]) {
      return ctx.badRequest(
        'Environment "' + targetEnv + '" is not configured as a sync target. ' +
        'Add it to targets in config/plugins.js'
      );
    }

    if (isDryRun && !pluginConfig.enableDryRun) {
      return ctx.badRequest('Dry-run mode is disabled in plugin configuration.');
    }

    const validStrategies = ['source-wins', 'target-wins', 'manual'];
    if (conflictStrategyOverride && !validStrategies.includes(conflictStrategyOverride)) {
      return ctx.badRequest('Invalid conflictStrategyOverride: ' + conflictStrategyOverride);
    }

    strapi.log.info(
      '[env-sync] Sync triggered by admin ' + adminUser?.id +
      ': ' + contentType + '#' + documentId + ' → ' + targetEnv +
      (isDryRun ? ' [DRY RUN]' : '')
    );

    const syncEngine = strapi.plugin(PLUGIN_ID).service('syncEngine');
    const result = await syncEngine.triggerSync({
      contentType, documentId, locale, targetEnv,
      triggeredByAdminId:   adminUser?.id,
      isDryRun,
      conflictStrategyOverride,
    });

    if (!result.success && result.reason === 'error') {
      ctx.status = 500;
      return (ctx.body = { error: { message: result.message }, logId: result.logId });
    }

    ctx.status = result.success ? 200 : 409;
    ctx.body   = result;
  },

  /**
   * GET /config
   *
   * Returns sanitised plugin configuration — no secrets exposed.
   * currentEnv and targets[] are the critical fields the admin UI needs.
   */
  async getConfig(ctx) {
    const pluginConfig = strapi.config.get('plugin::' + PLUGIN_ID);

    // Config not set at all — give a helpful error
    if (!pluginConfig) {
      ctx.status = 200;
      ctx.body = {
        currentEnv:       null,
        targets:          [],
        conflictStrategy: 'source-wins',
        enableDryRun:     true,
        enableRollback:   true,
        perContentType:   {},
        _warning:         'Plugin config not found. Add env-sync config to config/plugins.js',
      };
      return;
    }

    ctx.status = 200;
    ctx.body = {
      currentEnv:       pluginConfig.currentEnv       || null,
      targets:          Object.keys(pluginConfig.targets || {}),
      conflictStrategy: pluginConfig.conflictStrategy || 'source-wins',
      enableDryRun:     pluginConfig.enableDryRun     !== false,
      enableRollback:   pluginConfig.enableRollback   !== false,
      perContentType:   pluginConfig.perContentType   || {},
    };
  },
};

function _validateTriggerInput({ contentType, documentId, targetEnv }) {
  if (!contentType || typeof contentType !== 'string') return 'contentType is required.';
  if (!documentId  || typeof documentId  !== 'string') return 'documentId is required.';
  if (!targetEnv   || typeof targetEnv   !== 'string') return 'targetEnv is required.';
  if (!['SIT','QA','UAT','PROD'].includes(targetEnv))  return 'targetEnv must be one of: SIT, QA, UAT, PROD';
  return null;
}

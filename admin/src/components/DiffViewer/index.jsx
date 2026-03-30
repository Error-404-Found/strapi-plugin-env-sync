/**
 * DiffViewer — displays a structured diff summary in the sync confirmation modal.
 *
 * @module env-sync/admin/src/components/DiffViewer
 */

import React from 'react';
import {
  Box, Typography, Badge, Flex, Accordion,
  AccordionToggle, AccordionContent, AccordionGroup,
} from '@strapi/design-system';

/** Badge colour per change type */
const BADGE_THEME = {
  new:      'success',
  changed:  'warning',
  removed:  'danger',
  media:    'secondary',
  relation: 'neutral',
};

/**
 * @param {{ diff: object }} props
 *   diff shape: { isNew, hasChanges, fieldsChanged, relationsUpdated, mediaReuploaded, localesSynced, componentDiff, dynamicZoneDiff }
 */
export function DiffViewer({ diff }) {
  if (!diff) return null;

  if (!diff.hasChanges && !diff.isNew) {
    return (
      <Box padding={4} background="neutral100" borderRadius="4px">
        <Typography variant="omega" textColor="neutral600">
          ✓ Source and target are identical — no changes will be applied.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Summary badges */}
      <Flex gap={2} marginBottom={4} wrap="wrap">
        {diff.isNew && <Badge active backgroundColor="success100" textColor="success600">New document</Badge>}
        {diff.fieldsChanged?.length  > 0 && <Badge backgroundColor="warning100" textColor="warning600">{diff.fieldsChanged.length} field{diff.fieldsChanged.length !== 1 ? 's' : ''} changed</Badge>}
        {diff.relationsUpdated?.length > 0 && <Badge backgroundColor="neutral100" textColor="neutral600">{diff.relationsUpdated.length} relation{diff.relationsUpdated.length !== 1 ? 's' : ''} updated</Badge>}
        {diff.mediaReuploaded?.length > 0 && <Badge backgroundColor="secondary100" textColor="secondary600">{diff.mediaReuploaded.length} media file{diff.mediaReuploaded.length !== 1 ? 's' : ''}</Badge>}
        {diff.localesSynced?.length  > 0 && <Badge backgroundColor="primary100" textColor="primary600">{diff.localesSynced.length} locale{diff.localesSynced.length !== 1 ? 's' : ''}</Badge>}
      </Flex>

      <AccordionGroup>

        {/* Fields */}
        {diff.fieldsChanged?.length > 0 && (
          <Accordion id="diff-fields">
            <AccordionToggle title={'Changed fields (' + diff.fieldsChanged.length + ')'} />
            <AccordionContent>
              <Box padding={3}>
                {diff.fieldsChanged.map((f, i) => (
                  <Box key={i} marginBottom={2} padding={2} background="neutral100" borderRadius="4px">
                    <Typography variant="sigma" textColor="neutral800">{f.field}</Typography>
                    <Typography variant="pi" textColor="neutral500"> ({f.type})</Typography>
                    <Flex marginTop={1} gap={3}>
                      <Box flex={1}>
                        <Typography variant="pi" textColor="danger600">− {f.oldValue || 'empty'}</Typography>
                      </Box>
                      <Box flex={1}>
                        <Typography variant="pi" textColor="success600">+ {f.newValue || 'empty'}</Typography>
                      </Box>
                    </Flex>
                  </Box>
                ))}
              </Box>
            </AccordionContent>
          </Accordion>
        )}

        {/* Relations */}
        {diff.relationsUpdated?.length > 0 && (
          <Accordion id="diff-relations">
            <AccordionToggle title={'Relations (' + diff.relationsUpdated.length + ')'} />
            <AccordionContent>
              <Box padding={3}>
                {diff.relationsUpdated.map((r, i) => (
                  <Box key={i} marginBottom={2} padding={2} background="neutral100" borderRadius="4px">
                    <Typography variant="sigma">{r.field}</Typography>
                    <Typography variant="pi" textColor="neutral500"> → {r.targetContentType || r.target}</Typography>
                    {r.addedIds?.length > 0   && <Typography variant="pi" display="block" textColor="success600">+ Added: {r.addedIds.join(', ')}</Typography>}
                    {r.removedIds?.length > 0 && <Typography variant="pi" display="block" textColor="danger600">− Removed: {r.removedIds.join(', ')}</Typography>}
                  </Box>
                ))}
              </Box>
            </AccordionContent>
          </Accordion>
        )}

        {/* Media */}
        {diff.mediaReuploaded?.length > 0 && (
          <Accordion id="diff-media">
            <AccordionToggle title={'Media files (' + diff.mediaReuploaded.length + ')'} />
            <AccordionContent>
              <Box padding={3}>
                {diff.mediaReuploaded.map((m, i) => (
                  <Box key={i} marginBottom={1}>
                    <Typography variant="pi">{m.field}: {m.addedFiles?.length || 0} added, {m.removedFiles?.length || 0} removed</Typography>
                  </Box>
                ))}
              </Box>
            </AccordionContent>
          </Accordion>
        )}

        {/* Locales */}
        {diff.localesSynced?.length > 0 && (
          <Accordion id="diff-locales">
            <AccordionToggle title={'Locales to sync (' + diff.localesSynced.length + ')'} />
            <AccordionContent>
              <Box padding={3}>
                <Typography variant="pi">{diff.localesSynced.join(', ')}</Typography>
              </Box>
            </AccordionContent>
          </Accordion>
        )}

      </AccordionGroup>
    </Box>
  );
}

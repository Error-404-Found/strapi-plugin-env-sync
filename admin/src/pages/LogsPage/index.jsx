/**
 * LogsPage — full-featured audit log viewer in the Strapi admin panel.
 *
 * Features:
 *  - Filterable table (env, content type, status, date range)
 *  - Expandable diff summary rows
 *  - Rollback button per successful sync
 *  - CSV export
 *  - Pagination
 *
 * @module env-sync/admin/src/pages/LogsPage
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Flex, Button, Badge,
  Table, Thead, Tbody, Tr, Th, Td,
  Pagination, PreviousLink, NextLink, PageLink,
  Select, Option, DatePicker, Loader, Alert,
  TextInput, Divider, BaseHeaderLayout, ContentLayout,
  IconButton, Tooltip,
} from '@strapi/design-system';
import {
  Refresh, Download, ChevronDown, ChevronUp,
} from '@strapi/icons';
import { RollbackButton } from '../../components/RollbackButton';
import { DiffViewer } from '../../components/DiffViewer';
import { api } from '../../utils/api';

const STATUS_BADGE = {
  pending:     { bg: 'neutral100',  text: 'neutral600'  },
  in_progress: { bg: 'warning100',  text: 'warning700'  },
  success:     { bg: 'success100',  text: 'success700'  },
  failed:      { bg: 'danger100',   text: 'danger700'   },
  rolled_back: { bg: 'secondary100',text: 'secondary700'},
  dry_run:     { bg: 'primary100',  text: 'primary700'  },
};

const STATUS_OPTIONS = ['', 'pending', 'in_progress', 'success', 'failed', 'rolled_back', 'dry_run'];
const ENV_OPTIONS    = ['', 'SIT', 'QA', 'UAT', 'PROD'];

export function LogsPage() {
  const [logs,        setLogs]        = useState([]);
  const [pagination,  setPagination]  = useState({ page: 1, pageSize: 25, total: 0, pageCount: 1 });
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [exporting,   setExporting]   = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    page: 1, pageSize: 25,
    status: '', sourceEnv: '', targetEnv: '', contentType: '',
    dateFrom: '', dateTo: '',
  });

  const loadLogs = useCallback(async (f = filters) => {
    setLoading(true);
    setError(null);
    try {
      const clean = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '' && v !== null));
      const res = await api.getLogs(clean);
      setLogs(res.data || []);
      setPagination(res.pagination || { page: 1, pageSize: 25, total: 0, pageCount: 1 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadLogs(); }, []); // eslint-disable-line

  const setFilter = (key, val) => {
    const next = { ...filters, [key]: val, page: 1 };
    setFilters(next);
  };

  const handleSearch = () => loadLogs(filters);

  const handleReset = () => {
    const reset = { page: 1, pageSize: 25, status: '', sourceEnv: '', targetEnv: '', contentType: '', dateFrom: '', dateTo: '' };
    setFilters(reset);
    loadLogs(reset);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const clean = Object.fromEntries(Object.entries(filters).filter(([k, v]) => v !== '' && !['page','pageSize'].includes(k)));
      const blobUrl = await api.exportCsv(clean);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'env-sync-logs-' + Date.now() + '.csv';
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError('CSV export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handlePage = (page) => {
    const next = { ...filters, page };
    setFilters(next);
    loadLogs(next);
  };

  return (
    <Box>
      <BaseHeaderLayout
        title="Environment Sync Logs"
        subtitle={'Audit trail of all content sync operations. ' + pagination.total + ' total.'}
        as="h2"
        primaryAction={
          <Button
            variant="secondary"
            startIcon={exporting ? <Loader small /> : <Download />}
            onClick={handleExport}
            disabled={exporting || logs.length === 0}
          >
            Export CSV
          </Button>
        }
      />

      <ContentLayout>

        {/* ── Filters ──────────────────────────────────────────────── */}
        <Box background="neutral0" padding={4} shadow="filterShadow" borderRadius="4px" marginBottom={6}>
          <Typography variant="sigma" textColor="neutral600" marginBottom={3} display="block">Filters</Typography>
          <Flex gap={3} wrap="wrap" alignItems="flex-end">
            <Box minWidth="160px">
              <Select label="Status" value={filters.status} onChange={(v) => setFilter('status', v)} size="S">
                {STATUS_OPTIONS.map((s) => <Option key={s} value={s}>{s || 'All statuses'}</Option>)}
              </Select>
            </Box>
            <Box minWidth="120px">
              <Select label="Source env" value={filters.sourceEnv} onChange={(v) => setFilter('sourceEnv', v)} size="S">
                {ENV_OPTIONS.map((e) => <Option key={e} value={e}>{e || 'All'}</Option>)}
              </Select>
            </Box>
            <Box minWidth="120px">
              <Select label="Target env" value={filters.targetEnv} onChange={(v) => setFilter('targetEnv', v)} size="S">
                {ENV_OPTIONS.map((e) => <Option key={e} value={e}>{e || 'All'}</Option>)}
              </Select>
            </Box>
            <Box minWidth="200px">
              <TextInput
                label="Content type"
                placeholder="e.g. api::article"
                value={filters.contentType}
                onChange={(e) => setFilter('contentType', e.target.value)}
                size="S"
              />
            </Box>
            <Flex gap={2}>
              <Button onClick={handleSearch} size="S">Search</Button>
              <Button variant="tertiary" onClick={handleReset} size="S">Reset</Button>
              <IconButton
                label="Refresh"
                icon={<Refresh />}
                onClick={() => loadLogs(filters)}
              />
            </Flex>
          </Flex>
        </Box>

        {error && <Alert variant="danger" marginBottom={4}>{error}</Alert>}

        {/* ── Table ────────────────────────────────────────────────── */}
        <Box background="neutral0" shadow="filterShadow" borderRadius="4px">
          {loading ? (
            <Flex justifyContent="center" padding={10}><Loader /></Flex>
          ) : logs.length === 0 ? (
            <Flex justifyContent="center" padding={10}>
              <Typography textColor="neutral500">No log entries found.</Typography>
            </Flex>
          ) : (
            <Table colCount={8} rowCount={logs.length + 1}>
              <Thead>
                <Tr>
                  <Th><Typography variant="sigma">Status</Typography></Th>
                  <Th><Typography variant="sigma">Content type</Typography></Th>
                  <Th><Typography variant="sigma">Document ID</Typography></Th>
                  <Th><Typography variant="sigma">Route</Typography></Th>
                  <Th><Typography variant="sigma">Triggered by</Typography></Th>
                  <Th><Typography variant="sigma">Triggered at</Typography></Th>
                  <Th><Typography variant="sigma">Duration</Typography></Th>
                  <Th><Typography variant="sigma">Actions</Typography></Th>
                </Tr>
              </Thead>
              <Tbody>
                {logs.map((log) => {
                  const badgeCfg = STATUS_BADGE[log.status] || STATUS_BADGE.pending;
                  const isExpanded = expandedRow === log.documentId;
                  const user = log.triggeredBy
                    ? (log.triggeredBy.firstname + ' ' + log.triggeredBy.lastname).trim() || log.triggeredBy.email
                    : '—';

                  return (
                    <React.Fragment key={log.documentId}>
                      <Tr
                        style={{ cursor: 'pointer' }}
                        onClick={() => setExpandedRow(isExpanded ? null : log.documentId)}
                      >
                        <Td>
                          <Badge backgroundColor={badgeCfg.bg} textColor={badgeCfg.text}>
                            {log.isDryRun ? 'dry run' : log.status}
                          </Badge>
                        </Td>
                        <Td>
                          <Typography variant="omega" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                            {log.contentType?.split('.').pop() || log.contentType}
                          </Typography>
                        </Td>
                        <Td>
                          <Typography variant="omega" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                            {log.documentId?.slice(0, 8)}…
                          </Typography>
                        </Td>
                        <Td>
                          <Typography variant="omega">
                            {log.sourceEnv} → {log.targetEnv}
                          </Typography>
                        </Td>
                        <Td><Typography variant="omega">{user}</Typography></Td>
                        <Td>
                          <Typography variant="omega">
                            {log.triggeredAt ? new Date(log.triggeredAt).toLocaleString() : '—'}
                          </Typography>
                        </Td>
                        <Td>
                          <Typography variant="omega">
                            {log.duration != null ? log.duration + 'ms' : '—'}
                          </Typography>
                        </Td>
                        <Td onClick={(e) => e.stopPropagation()}>
                          <Flex gap={2}>
                            {log.status === 'success' && log.snapshotId && (
                              <RollbackButton
                                snapshotId={log.snapshotId}
                                contentType={log.contentType}
                                documentId={log.documentId}
                                onSuccess={() => loadLogs(filters)}
                              />
                            )}
                            <IconButton
                              label={isExpanded ? 'Collapse' : 'Expand diff'}
                              icon={isExpanded ? <ChevronUp /> : <ChevronDown />}
                              onClick={() => setExpandedRow(isExpanded ? null : log.documentId)}
                            />
                          </Flex>
                        </Td>
                      </Tr>

                      {/* ── Expanded diff row ─────────────────────── */}
                      {isExpanded && (
                        <Tr>
                          <Td colSpan={8}>
                            <Box padding={4} background="neutral50">
                              {log.errorMessage && (
                                <Alert variant="danger" marginBottom={3}>
                                  {log.errorMessage}
                                </Alert>
                              )}
                              <DiffViewer diff={log.diffSummary} />
                              {!log.diffSummary && !log.errorMessage && (
                                <Typography variant="pi" textColor="neutral500">No diff data available.</Typography>
                              )}
                            </Box>
                          </Td>
                        </Tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </Tbody>
            </Table>
          )}
        </Box>

        {/* ── Pagination ───────────────────────────────────────────── */}
        {pagination.pageCount > 1 && (
          <Flex justifyContent="center" marginTop={6}>
            <Pagination activePage={pagination.page} pageCount={pagination.pageCount}>
              <PreviousLink onClick={() => handlePage(pagination.page - 1)}>Previous</PreviousLink>
              {Array.from({ length: pagination.pageCount }, (_, i) => i + 1).map((p) => (
                <PageLink key={p} number={p} onClick={() => handlePage(p)}>{p}</PageLink>
              ))}
              <NextLink onClick={() => handlePage(pagination.page + 1)}>Next</NextLink>
            </Pagination>
          </Flex>
        )}

      </ContentLayout>
    </Box>
  );
}

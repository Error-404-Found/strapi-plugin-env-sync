/**
 * LogsPage — full-featured audit log viewer.
 *
 * All @strapi/design-system v2 confirmed exports only.
 * Layout done with Box/Flex (no BaseHeaderLayout/ContentLayout — removed in v5).
 *
 * @module env-sync/admin/src/pages/LogsPage
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Flex, Button, Badge,
  Table, Thead, Tbody, Tr, Th, Td,
  Pagination, PreviousLink, NextLink, PageLink,
  SingleSelect, SingleSelectOption,
  Loader, TextInput,
} from '@strapi/design-system';
import { RollbackButton } from '../../components/RollbackButton';
import { DiffViewer }     from '../../components/DiffViewer';
import { api }            from '../../utils/api';

const STATUS_OPTIONS = ['', 'pending', 'in_progress', 'success', 'failed', 'rolled_back', 'dry_run'];
const ENV_OPTIONS    = ['', 'SIT', 'QA', 'UAT', 'PROD'];

const STATUS_BG = {
  pending:     '#dde0eb',
  in_progress: '#fdf4dc',
  success:     '#d9f0d3',
  failed:      '#fce4e4',
  rolled_back: '#e8d9f5',
  dry_run:     '#d5e3fb',
};

export function LogsPage() {
  const [logs,        setLogs]        = useState([]);
  const [pagination,  setPagination]  = useState({ page: 1, pageSize: 25, total: 0, pageCount: 1 });
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [exporting,   setExporting]   = useState(false);
  const [filters,     setFilters]     = useState({
    page: 1, pageSize: 25,
    status: '', sourceEnv: '', targetEnv: '', contentType: '',
  });

  const loadLogs = useCallback(async (f) => {
    setLoading(true);
    setError(null);
    try {
      const active = f || filters;
      const clean  = Object.fromEntries(Object.entries(active).filter(([, v]) => v !== ''));
      const res    = await api.getLogs(clean);
      setLogs(res.data || []);
      setPagination(res.pagination || { page: 1, pageSize: 25, total: 0, pageCount: 1 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadLogs(); }, []); // eslint-disable-line

  const setFilter   = (key, val) => setFilters((p) => ({ ...p, [key]: val, page: 1 }));
  const handleReset = () => {
    const r = { page: 1, pageSize: 25, status: '', sourceEnv: '', targetEnv: '', contentType: '' };
    setFilters(r);
    loadLogs(r);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const clean   = Object.fromEntries(Object.entries(filters).filter(([k, v]) => v !== '' && !['page','pageSize'].includes(k)));
      const blobUrl = await api.exportCsv(clean);
      const a = document.createElement('a');
      a.href = blobUrl; a.download = 'env-sync-logs-' + Date.now() + '.csv'; a.click();
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
    <Box padding={8} background="neutral100" style={{ minHeight: '100vh' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <Flex justifyContent="space-between" alignItems="flex-start" marginBottom={6}>
        <Box>
          <Flex alignItems="center" gap={3} marginBottom={1}>
            {/* Custom SVG icon */}
            <Box
              style={{
                width: '40px', height: '40px', borderRadius: '8px',
                background: '#4945ff', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 256 256" fill="white">
                <path d="M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h31.39L182.06,70.63A80,80,0,1,0,202.7,172a8,8,0,1,1,13.85,8A96,96,0,1,1,165.94,50.74L184,68.6V48a8,8,0,0,1,16,0Z"/>
              </svg>
            </Box>
            <Typography variant="alpha" as="h1" fontWeight="bold">
              Environment Sync Logs
            </Typography>
          </Flex>
          <Typography variant="epsilon" textColor="neutral500">
            Audit trail of all content sync operations — {pagination.total} total entries
          </Typography>
        </Box>
        <Flex gap={2}>
          <Button variant="secondary" onClick={() => loadLogs(filters)} disabled={loading}>
            ↻ Refresh
          </Button>
          <Button
            variant="secondary"
            onClick={handleExport}
            disabled={exporting || logs.length === 0}
          >
            {exporting ? '…' : '↓ Export CSV'}
          </Button>
        </Flex>
      </Flex>

      {/* ── Filters ────────────────────────────────────────────────── */}
      <Box
        background="neutral0" padding={5} borderRadius="8px" marginBottom={6}
        style={{ border: '1px solid #dde0eb', boxShadow: '0 1px 4px rgba(33,33,52,0.08)' }}
      >
        <Typography variant="sigma" textColor="neutral500" marginBottom={3} display="block">
          FILTERS
        </Typography>
        <Flex gap={3} wrap="wrap" alignItems="flex-end">
          <Box minWidth="160px">
            <SingleSelect label="Status" value={filters.status} onChange={(v) => setFilter('status', v)}>
              {STATUS_OPTIONS.map((s) => (
                <SingleSelectOption key={s} value={s}>{s || 'All statuses'}</SingleSelectOption>
              ))}
            </SingleSelect>
          </Box>
          <Box minWidth="120px">
            <SingleSelect label="Source" value={filters.sourceEnv} onChange={(v) => setFilter('sourceEnv', v)}>
              {ENV_OPTIONS.map((e) => <SingleSelectOption key={e} value={e}>{e || 'All'}</SingleSelectOption>)}
            </SingleSelect>
          </Box>
          <Box minWidth="120px">
            <SingleSelect label="Target" value={filters.targetEnv} onChange={(v) => setFilter('targetEnv', v)}>
              {ENV_OPTIONS.map((e) => <SingleSelectOption key={e} value={e}>{e || 'All'}</SingleSelectOption>)}
            </SingleSelect>
          </Box>
          <Box minWidth="200px">
            <TextInput
              label="Content type"
              placeholder="e.g. api::article"
              value={filters.contentType}
              onChange={(e) => setFilter('contentType', e.target.value)}
            />
          </Box>
          <Flex gap={2} style={{ paddingTop: '20px' }}>
            <Button size="S" onClick={() => loadLogs(filters)}>Search</Button>
            <Button size="S" variant="tertiary" onClick={handleReset}>Reset</Button>
          </Flex>
        </Flex>
      </Box>

      {/* ── Error ──────────────────────────────────────────────────── */}
      {error && (
        <Box padding={4} background="danger100" borderRadius="4px" marginBottom={4}
          style={{ border: '1px solid #f5c0be' }}>
          <Typography textColor="danger600">{error}</Typography>
        </Box>
      )}

      {/* ── Table ──────────────────────────────────────────────────── */}
      <Box
        background="neutral0" borderRadius="8px"
        style={{ border: '1px solid #dde0eb', boxShadow: '0 1px 4px rgba(33,33,52,0.08)', overflow: 'hidden' }}
      >
        {loading ? (
          <Flex justifyContent="center" padding={10}><Loader /></Flex>
        ) : logs.length === 0 ? (
          <Flex justifyContent="center" alignItems="center" padding={10} direction="column" gap={3}>
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 256 256" fill="#aaa">
              <path d="M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h31.39L182.06,70.63A80,80,0,1,0,202.7,172a8,8,0,1,1,13.85,8A96,96,0,1,1,165.94,50.74L184,68.6V48a8,8,0,0,1,16,0Z"/>
            </svg>
            <Typography textColor="neutral500">No sync logs found. Trigger a sync to see it here.</Typography>
          </Flex>
        ) : (
          <Table colCount={8} rowCount={logs.length + 1}>
            <Thead>
              <Tr>
                {['Status','Content type','Document','Route','Triggered by','When','Duration','Actions'].map((h) => (
                  <Th key={h}>
                    <Typography variant="sigma" textColor="neutral600">{h}</Typography>
                  </Th>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {logs.map((log) => {
                const isExpanded = expandedRow === log.documentId;
                const user = log.triggeredBy
                  ? ((log.triggeredBy.firstname || '') + ' ' + (log.triggeredBy.lastname || '')).trim() || log.triggeredBy.email
                  : '—';
                const bgColor = STATUS_BG[log.status] || '#f0f0f0';

                return (
                  <React.Fragment key={log.documentId}>
                    <Tr
                      style={{ cursor: 'pointer' }}
                      onClick={() => setExpandedRow(isExpanded ? null : log.documentId)}
                    >
                      <Td>
                        <Box
                          style={{
                            display: 'inline-block', padding: '2px 8px',
                            borderRadius: '12px', background: bgColor,
                            fontSize: '11px', fontWeight: 600,
                          }}
                        >
                          {log.isDryRun ? 'dry run' : log.status?.replace('_', ' ')}
                        </Box>
                      </Td>
                      <Td>
                        <Typography variant="omega" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                          {log.contentType?.split('.').pop() || log.contentType}
                        </Typography>
                      </Td>
                      <Td>
                        <Typography variant="omega" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                          {(log.syncDocumentId || log.documentId)?.slice(0, 10)}…
                        </Typography>
                      </Td>
                      <Td>
                        <Typography variant="omega">
                          {log.sourceEnv} → {log.targetEnv}
                        </Typography>
                      </Td>
                      <Td><Typography variant="omega">{user}</Typography></Td>
                      <Td>
                        <Typography variant="omega" style={{ fontSize: '12px' }}>
                          {log.triggeredAt ? new Date(log.triggeredAt).toLocaleString() : '—'}
                        </Typography>
                      </Td>
                      <Td>
                        <Typography variant="omega">
                          {log.duration != null ? log.duration + 'ms' : '—'}
                        </Typography>
                      </Td>
                      <Td onClick={(e) => e.stopPropagation()}>
                        <Flex gap={2} alignItems="center">
                          {log.status === 'success' && log.snapshotId && (
                            <RollbackButton
                              snapshotId={log.snapshotId}
                              contentType={log.contentType}
                              documentId={log.syncDocumentId || log.documentId}
                              onSuccess={() => loadLogs(filters)}
                            />
                          )}
                          <Button
                            variant="ghost" size="S"
                            onClick={() => setExpandedRow(isExpanded ? null : log.documentId)}
                          >
                            {isExpanded ? '▲' : '▼'}
                          </Button>
                        </Flex>
                      </Td>
                    </Tr>

                    {/* Expanded diff row */}
                    {isExpanded && (
                      <Tr>
                        <Td colSpan={8}>
                          <Box padding={4} background="neutral50">
                            {log.errorMessage && (
                              <Box padding={3} background="danger100" borderRadius="4px" marginBottom={3}
                                style={{ border: '1px solid #f5c0be' }}>
                                <Typography variant="pi" textColor="danger600">
                                  {log.errorMessage}
                                </Typography>
                              </Box>
                            )}
                            <DiffViewer diff={log.diffSummary} />
                            {!log.diffSummary && !log.errorMessage && (
                              <Typography variant="pi" textColor="neutral400">No diff data recorded.</Typography>
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

      {/* ── Pagination ─────────────────────────────────────────────── */}
      {pagination.pageCount > 1 && (
        <Flex justifyContent="center" marginTop={6}>
          <Pagination activePage={pagination.page} pageCount={pagination.pageCount}>
            <PreviousLink onClick={() => handlePage(Math.max(1, pagination.page - 1))}>
              Previous
            </PreviousLink>
            {Array.from({ length: Math.min(pagination.pageCount, 7) }, (_, i) => i + 1).map((p) => (
              <PageLink key={p} number={p} onClick={() => handlePage(p)}>{p}</PageLink>
            ))}
            <NextLink onClick={() => handlePage(Math.min(pagination.pageCount, pagination.page + 1))}>
              Next
            </NextLink>
          </Pagination>
        </Flex>
      )}

    </Box>
  );
}

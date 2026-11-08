import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Inbox,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import api, { getErrorMessage } from '../api';
import { useAuth } from '../auth/AuthContext';

function compareValues(a, b) {
  const aEmpty = a === null || a === undefined || a === '';
  const bEmpty = b === null || b === undefined || b === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  const aNumber = Number(a);
  const bNumber = Number(b);
  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) return aNumber - bNumber;

  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function rowKey(config, row) {
  if (config.keyFields) {
    return config.keyFields.map((field) => row[field]).join('-');
  }
  return row[config.pk];
}

function rowLabel(config, row) {
  if (!row) return config.singular;
  return (
    row.Name ||
    row.Title ||
    row.CourseName ||
    row.SubjectName ||
    row.AssessmentTitle ||
    row.Reason ||
    config.singular
  );
}

function badgeTone(value) {
  const normalized = String(value || '').toLowerCase();
  if (['active', 'present', 'approved', 'create'].includes(normalized)) return 'success';
  if (['inactive', 'suspended', 'absent', 'rejected', 'delete'].includes(normalized)) {
    return 'danger';
  }
  if (['late', 'pending', 'update'].includes(normalized)) return 'warning';
  if (['excused', 'graduated'].includes(normalized)) return 'info';
  return 'neutral';
}

function formatDate(value, withTime = false) {
  if (!value) return '—';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return String(value);

  const options = withTime
    ? {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }
    : { month: 'short', day: 'numeric', year: 'numeric' };

  return new Intl.DateTimeFormat('en', options).format(date);
}

function emptyForm(config, row = null) {
  const values = {};
  for (const field of config.fields) {
    values[field.name] = row ? (row[field.name] ?? '') : (field.defaultValue ?? '');
  }
  return values;
}

export default function ResourcePage({ config }) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState(() => config.defaultSort || null);
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [options, setOptions] = useState({});
  const [optionsLoading, setOptionsLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [actionReason, setActionReason] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [maintenanceError, setMaintenanceError] = useState('');
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);

  const [statusSavingId, setStatusSavingId] = useState(null);

  const Icon = config.icon;
  const roleCanWrite = !config.writeRoles || config.writeRoles.includes(user?.role);
  const canCreate = roleCanWrite && config.canCreate !== false;
  const canEdit = roleCanWrite && config.canEdit !== false;
  const canDelete = roleCanWrite && config.canDelete !== false;

  const optionEndpoints = useMemo(() => {
    const endpoints = config.fields
      .filter((field) => field.options?.endpoint)
      .map((field) => field.options.endpoint);
    return [...new Set(endpoints)];
  }, [config]);

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        const response = await api.get(config.endpoint);
        setRows(response.data);
      } catch (requestError) {
        setError(getErrorMessage(requestError, `Could not load ${config.title.toLowerCase()}.`));
      } finally {
        setLoading(false);
      }
    },
    [config.endpoint, config.title],
  );

  const loadOptions = useCallback(async () => {
    if (optionEndpoints.length === 0) return;
    setOptionsLoading(true);
    try {
      const entries = await Promise.all(
        optionEndpoints.map(async (endpoint) => {
          const response = await api.get(endpoint);
          return [endpoint, response.data];
        }),
      );
      setOptions(Object.fromEntries(entries));
    } catch {
      // Form still works, but select lists may be empty. The page error covers real failures.
    } finally {
      setOptionsLoading(false);
    }
  }, [optionEndpoints]);

  useEffect(() => {
    setSort(config.defaultSort || null);
    setSearch('');
    setStatusFilter('ALL');
  }, [config]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    function handleKey(event) {
      if (event.key !== 'Escape') return;
      if (deleteTarget) {
        setDeleteTarget(null);
        setDeleteReason('');
        setDeleteError('');
      } else if (modalOpen) {
        setModalOpen(false);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modalOpen, deleteTarget]);

  function refresh() {
    load({ quiet: true });
    loadOptions();
  }

  function openCreate() {
    setEditingRow(null);
    setFormValues(emptyForm(config));
    setActionReason('');
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditingRow(row);
    setFormValues(emptyForm(config, row));
    setActionReason('');
    setFormError('');
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditingRow(null);
    setActionReason('');
    setFormError('');
  }

  function updateFormValue(name, value) {
    setFormValues((current) => ({ ...current, [name]: value }));
  }

  function toggleSort(column) {
    if (column.sortable === false) return;
    setSort((current) =>
      current?.key === column.key
        ? { key: column.key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key: column.key, direction: 'asc' },
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');

    if (editingRow && config.requiresReasonOnEdit && !actionReason.trim()) {
      setFormError(config.reasonMessage || 'A reason is required for this edit.');
      return;
    }

    setSaving(true);

    try {
      if (editingRow) {
        const payload = { ...formValues };
        if (config.requiresReasonOnEdit) payload.reason = actionReason.trim();
        await api.put(`${config.endpoint}/${editingRow[config.pk]}`, payload);
        setNotice({ type: 'success', text: `${config.singular} updated.` });
      } else {
        await api.post(config.endpoint, formValues);
        setNotice({ type: 'success', text: `${config.singular} created.` });
      }
      setModalOpen(false);
      setEditingRow(null);
      setActionReason('');
      await load({ quiet: true });
      await loadOptions();
    } catch (requestError) {
      setFormError(getErrorMessage(requestError, 'Could not save this record.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError('');

    if (config.requiresReasonOnDelete && !deleteReason.trim()) {
      setDeleteError(config.deleteReasonMessage || 'A reason is required for this deletion.');
      return;
    }

    setDeleting(true);

    try {
      const url =
        config.deletePath?.(deleteTarget) || `${config.endpoint}/${deleteTarget[config.pk]}`;
      await api.delete(
        url,
        config.requiresReasonOnDelete ? { data: { reason: deleteReason.trim() } } : undefined,
      );
      setNotice({ type: 'success', text: `${config.singular} deleted.` });
      setDeleteTarget(null);
      setDeleteReason('');
      await load({ quiet: true });
    } catch (requestError) {
      setDeleteError(getErrorMessage(requestError, 'Could not delete this record.'));
    } finally {
      setDeleting(false);
    }
  }

  async function handleMaintenance() {
    if (!config.maintenance) return;
    setMaintenanceError('');
    setMaintenanceBusy(true);
    try {
      const response = await api.request({
        url: config.maintenance.endpoint,
        method: config.maintenance.method || 'post',
      });
      setNotice({
        type: 'success',
        text:
          config.maintenance.successMessage?.(response.data) ||
          response.data?.message ||
          'Log cleanup complete.',
      });
      setMaintenanceOpen(false);
      await load({ quiet: true });
    } catch (requestError) {
      setMaintenanceError(
        getErrorMessage(requestError, 'Could not clean the audit log right now.'),
      );
    } finally {
      setMaintenanceBusy(false);
    }
  }

  async function handleStatusChange(row, status) {
    const id = row[config.pk];
    setStatusSavingId(id);
    try {
      await api.patch(config.statusEndpoint(row), { status });
      setRows((current) =>
        current.map((item) => (item[config.pk] === id ? { ...item, Status: status } : item)),
      );
      setNotice({ type: 'success', text: `Log marked as ${status}.` });
    } catch (requestError) {
      setNotice({
        type: 'error',
        text: getErrorMessage(requestError, 'Could not update the log status.'),
      });
    } finally {
      setStatusSavingId(null);
    }
  }

  const hasStatusColumn = useMemo(
    () => config.columns.some((col) => col.key === 'Status' || col.type === 'statusEditor'),
    [config.columns],
  );

  const statusCounts = useMemo(() => {
    if (!hasStatusColumn) return {};
    const counts = { ALL: rows.length };
    for (const r of rows) {
      const s = String(r.Status || 'Pending');
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }, [rows, hasStatusColumn]);

  const filteredRows = useMemo(() => {
    let pool = rows;
    if (hasStatusColumn && statusFilter !== 'ALL') {
      pool = pool.filter((r) => String(r.Status || 'Pending') === statusFilter);
    }

    const term = search.trim().toLowerCase();
    const matching = term
      ? pool.filter((row) =>
          Object.values(row)
            .map((value) => String(value ?? ''))
            .join(' ')
            .toLowerCase()
            .includes(term),
        )
      : pool;

    if (!sort) return matching;

    const direction = sort.direction === 'desc' ? -1 : 1;
    return [...matching].sort(
      (a, b) => compareValues(a[sort.key], b[sort.key]) * direction,
    );
  }, [rows, search, sort, hasStatusColumn, statusFilter]);

  const showActions = canEdit || canDelete;

  return (
    <div className="resource-page">
      <header className="page-header">
        <div className="page-heading">
          <span className="page-icon">
            <Icon size={23} />
          </span>
          <div>
            <h1>{config.title}</h1>
            <p>{config.description}</p>
          </div>
        </div>
        <div className="page-header-actions">
          {!roleCanWrite && <span className="count-pill view-only-pill">View only</span>}
          <span className="count-pill">{rows.length} records</span>
          {config.maintenance && roleCanWrite && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setMaintenanceError('');
                setMaintenanceOpen(true);
              }}
            >
              <Trash2 size={17} />
              {config.maintenance.label}
            </button>
          )}
          {canCreate && (
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <Plus size={18} />
              Add {config.singular}
            </button>
          )}
        </div>
      </header>

      {notice && (
        <div className={`alert alert-${notice.type === 'error' ? 'error' : 'success'}`}>
          {notice.type === 'error' ? <XCircle size={17} /> : <CheckCircle2 size={17} />}
          <span>{notice.text}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <XCircle size={17} />
          <span>{error}</span>
          <button type="button" className="alert-action" onClick={() => load()}>
            Try again
          </button>
        </div>
      )}

      {config.endpoint === '/logs' && rows.length >= 20 && (
        <div className="alert alert-warning log-maintenance-banner">
          <AlertTriangle size={20} />
          <div className="maintenance-banner-text">
            <strong>Log Maintenance Recommended</strong>
            <span>
              The audit log currently has {rows.length} entries (threshold: 20).
              Cleaning resolved entries keeps the database size optimized while preserving pending actions.
            </span>
          </div>
          {roleCanWrite && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setMaintenanceError('');
                setMaintenanceOpen(true);
              }}
            >
              <Trash2 size={15} />
              Clean Resolved Logs
            </button>
          )}
        </div>
      )}

      <div className="table-card">
        {hasStatusColumn && rows.length > 0 && (
          <div className="status-tabs" role="tablist">
            {['ALL', 'Pending', 'Approved', 'Rejected'].map((statusKey) => {
              if (
                statusKey !== 'ALL' &&
                !statusCounts[statusKey] &&
                config.endpoint !== '/logs'
              ) {
                return null;
              }
              const count = statusCounts[statusKey] || 0;
              const label =
                statusKey === 'ALL'
                  ? 'All'
                  : statusKey === 'Pending'
                    ? 'Pending Review'
                    : statusKey;
              return (
                <button
                  key={statusKey}
                  type="button"
                  className={`status-tab ${statusFilter === statusKey ? 'active' : ''}`}
                  onClick={() => setStatusFilter(statusKey)}
                >
                  <span>{label}</span>
                  <span className="tab-count">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="table-toolbar">
          <label className="search-box">
            <Search size={17} />
            <input
              type="search"
              placeholder={`Search ${config.title.toLowerCase()}…`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="search-clear"
              >
                <X size={15} />
              </button>
            )}
          </label>

          <div className="table-toolbar-right">
            <span className="table-hint">
              {search ? `${filteredRows.length} of ${rows.length}` : 'All records'}
            </span>
            <button
              type="button"
              className="icon-button"
              onClick={refresh}
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCw size={17} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="table-state">
            <Loader2 size={26} className="spin" />
            <p>Loading {config.title.toLowerCase()}…</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="table-state">
            <span className="empty-icon">
              <Inbox size={28} />
            </span>
            <h3>{search ? 'No matching records' : `No ${config.title.toLowerCase()} yet`}</h3>
            <p>
              {search
                ? 'Try a different search term.'
                : canCreate
                  ? `Add your first ${config.singular.toLowerCase()} to get started.`
                  : 'Records will appear here as activity happens.'}
            </p>
            {!search && canCreate && (
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                <Plus size={17} />
                Add {config.singular}
              </button>
            )}
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {config.columns.map((column) => (
                    <th key={column.key}>
                      {column.sortable === false ? (
                        column.label
                      ) : (
                        <button
                          type="button"
                          className={`sort-button ${sort?.key === column.key ? 'active' : ''}`}
                          onClick={() => toggleSort(column)}
                          title={`Sort by ${column.label}`}
                        >
                          <span>{column.label}</span>
                          {sort?.key === column.key ? (
                            sort.direction === 'asc' ? (
                              <ArrowUp size={12} />
                            ) : (
                              <ArrowDown size={12} />
                            )
                          ) : (
                            <ArrowUpDown size={12} className="sort-idle" />
                          )}
                        </button>
                      )}
                    </th>
                  ))}
                  {showActions && <th className="actions-head">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={rowKey(config, row)}>
                    {config.columns.map((column) => {
                      const value = row[column.key];

                      if (column.type === 'statusEditor') {
                        return (
                          <td key={column.key}>
                            <select
                              className={`status-select status-${badgeTone(value)}`}
                              value={value || 'Pending'}
                              disabled={statusSavingId === row[config.pk] || user?.role !== 'Admin'}
                              onChange={(event) => handleStatusChange(row, event.target.value)}
                            >
                              <option value="Pending">Pending</option>
                              <option value="Approved">Approved</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                          </td>
                        );
                      }

                      if (column.type === 'badge') {
                        return (
                          <td key={column.key}>
                            <span className={`badge badge-${badgeTone(value)}`}>
                              {value || '—'}
                            </span>
                          </td>
                        );
                      }

                      if (column.type === 'id') {
                        return (
                          <td key={column.key}>
                            <span className="cell-id">#{value}</span>
                          </td>
                        );
                      }

                      if (column.type === 'date') {
                        return <td key={column.key}>{formatDate(value)}</td>;
                      }

                      if (column.type === 'datetime') {
                        return <td key={column.key}>{formatDate(value, true)}</td>;
                      }

                      if (column.type === 'number') {
                        return (
                          <td key={column.key} className="cell-number">
                            {value ?? '—'}
                          </td>
                        );
                      }

                      if (column.type === 'score') {
                        return (
                          <td key={column.key}>
                            <span className="score-pill">
                              <strong>{value ?? '—'}</strong>
                              <small>/ {row.MaxScore ?? '—'}</small>
                            </span>
                          </td>
                        );
                      }

                      if (column.type === 'code') {
                        return (
                          <td key={column.key}>
                            <code className="cell-code">{value ?? '—'}</code>
                          </td>
                        );
                      }

                      if (column.type === 'muted') {
                        return (
                          <td key={column.key} className="cell-muted">
                            {value || '—'}
                          </td>
                        );
                      }

                      if (column.type === 'wide') {
                        return (
                          <td key={column.key} className="cell-wide">
                            {value || '—'}
                          </td>
                        );
                      }

                      return <td key={column.key}>{value || '—'}</td>;
                    })}

                    {showActions && (
                      <td>
                        <div className="row-actions">
                          {canEdit && (
                            <button
                              type="button"
                              className="icon-button"
                              title={`Edit ${config.singular}`}
                              aria-label={`Edit ${config.singular}`}
                              onClick={() => openEdit(row)}
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              className="icon-button icon-button-danger"
                              title={`Delete ${config.singular}`}
                              aria-label={`Delete ${config.singular}`}
                              onClick={() => {
                                setDeleteTarget(row);
                                setDeleteReason('');
                                setDeleteError('');
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="form-title">
            <div className="modal-head">
              <div>
                <span className="modal-kicker">{editingRow ? 'Edit record' : 'New record'}</span>
                <h2 id="form-title">
                  {editingRow ? `Edit ${config.singular}` : `Add ${config.singular}`}
                </h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={closeModal}
                aria-label="Close dialog"
                disabled={saving}
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formError && (
                  <div className="alert alert-error">
                    <XCircle size={17} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="form-grid">
                  {config.fields.map((field) => {
                    const id = `field-${field.name}`;
                    const value = formValues[field.name] ?? '';
                    const isPassword = field.type === 'password';
                    const editHint = editingRow && isPassword ? field.editHint : null;

                    if (field.type === 'select') {
                      const choices = field.options
                        ? options[field.options.endpoint] || []
                        : (field.choices || []).map((choice) => ({
                            value: choice,
                            label: choice,
                          }));
                      const isObjectOptions = Boolean(field.options);

                      return (
                        <label
                          className={`field ${field.full ? 'span-2' : ''}`}
                          key={field.name}
                          htmlFor={id}
                        >
                          <span className="field-label">
                            {field.label}
                            {field.required && <em>*</em>}
                          </span>
                          <select
                            id={id}
                            className="input-control"
                            value={value}
                            onChange={(event) => updateFormValue(field.name, event.target.value)}
                            required={field.required}
                            disabled={field.options && optionsLoading}
                          >
                            <option value="">{field.placeholder || 'Choose an option'}</option>
                            {choices.map((choice) => {
                              const optionValue = isObjectOptions
                                ? choice[field.options.value]
                                : choice.value;
                              const optionLabel = isObjectOptions
                                ? typeof field.options.label === 'function'
                                  ? field.options.label(choice)
                                  : choice[field.options.label]
                                : choice.label;
                              return (
                                <option key={optionValue} value={optionValue}>
                                  {optionLabel}
                                </option>
                              );
                            })}
                          </select>
                          {field.options && choices.length === 0 && !optionsLoading && (
                            <span className="field-hint">
                              No options yet — create the related record first.
                            </span>
                          )}
                          {field.hint && <span className="field-hint">{field.hint}</span>}
                        </label>
                      );
                    }

                    if (field.type === 'textarea') {
                      return (
                        <label
                          className={`field ${field.full ? 'span-2' : ''}`}
                          key={field.name}
                          htmlFor={id}
                        >
                          <span className="field-label">{field.label}</span>
                          <textarea
                            id={id}
                            className="input-control"
                            rows={3}
                            value={value}
                            onChange={(event) => updateFormValue(field.name, event.target.value)}
                            placeholder={field.placeholder}
                            maxLength={field.maxLength}
                          />
                          {field.hint && <span className="field-hint">{field.hint}</span>}
                        </label>
                      );
                    }

                    return (
                      <label
                        className={`field ${field.full ? 'span-2' : ''}`}
                        key={field.name}
                        htmlFor={id}
                      >
                        <span className="field-label">
                          {field.label}
                          {field.required && <em>*</em>}
                        </span>
                        <input
                          id={id}
                          className="input-control"
                          type={
                            isPassword
                              ? 'password'
                              : field.type === 'number'
                                ? 'number'
                                : field.type === 'date'
                                  ? 'date'
                                  : field.type === 'email'
                                    ? 'email'
                                    : 'text'
                          }
                          value={value}
                          onChange={(event) => updateFormValue(field.name, event.target.value)}
                          placeholder={field.placeholder}
                          required={field.required && !editingRow}
                          maxLength={field.maxLength}
                          min={field.min}
                          max={field.max}
                          step={field.step}
                          minLength={field.minLength}
                          autoComplete={isPassword ? 'new-password' : 'off'}
                        />
                        {editHint && <span className="field-hint">{editHint}</span>}
                        {field.hint && !editHint && (
                          <span className="field-hint">{field.hint}</span>
                        )}
                      </label>
                    );
                  })}

                  {editingRow && config.requiresReasonOnEdit && (
                    <label className="field span-2" htmlFor="action-reason">
                      <span className="field-label">
                        {config.reasonLabel || 'Reason for this change'}
                        <em>*</em>
                      </span>
                      <textarea
                        id="action-reason"
                        className="input-control"
                        rows={3}
                        value={actionReason}
                        onChange={(event) => setActionReason(event.target.value)}
                        placeholder={
                          config.reasonPlaceholder ||
                          'Explain why this record needs to be changed.'
                        }
                        maxLength={255}
                        required
                      />
                      <span className="field-hint">
                        This reason is saved in the audit log for administrator review.
                      </span>
                    </label>
                  )}
                </div>
              </div>

              <div className="modal-foot">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving && <Loader2 size={16} className="spin" />}
                  {saving ? 'Saving…' : editingRow ? 'Save changes' : `Add ${config.singular}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) {
              setDeleteTarget(null);
              setDeleteReason('');
              setDeleteError('');
            }
          }}
        >
          <div className="confirm-card" role="alertdialog" aria-modal="true">
            <span className="confirm-icon">
              <AlertTriangle size={24} />
            </span>
            <h2>Delete this {config.singular.toLowerCase()}?</h2>
            <p>
              <strong>{rowLabel(config, deleteTarget)}</strong> will be permanently removed. This
              action cannot be undone.
            </p>

            {config.deleteWarning && (
              <div className="delete-warning">
                <AlertTriangle size={16} />
                <span>{config.deleteWarning}</span>
              </div>
            )}

            {config.requiresReasonOnDelete && (
              <label className="field confirm-reason" htmlFor="delete-reason">
                <span className="field-label">
                  Reason for deleting
                  <em>*</em>
                </span>
                <textarea
                  id="delete-reason"
                  className="input-control"
                  rows={3}
                  value={deleteReason}
                  onChange={(event) => setDeleteReason(event.target.value)}
                  placeholder={
                    config.deleteReasonPlaceholder ||
                    'Explain why this record is being deleted.'
                  }
                  maxLength={255}
                  required
                />
                <span className="field-hint">
                  This reason is saved in the audit log for administrator review.
                </span>
              </label>
            )}

            {deleteError && (
              <div className="alert alert-error">
                <XCircle size={17} />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="confirm-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteReason('');
                  setDeleteError('');
                }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting && <Loader2 size={16} className="spin" />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      {maintenanceOpen && config.maintenance && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !maintenanceBusy) {
              setMaintenanceOpen(false);
              setMaintenanceError('');
            }
          }}
        >
          <div className="confirm-card" role="alertdialog" aria-modal="true">
            <span className="confirm-icon confirm-icon-neutral">
              <Trash2 size={24} />
            </span>
            <h2>{config.maintenance.title || 'Maintain the audit log?'}</h2>
            <p>
              {config.maintenance.description ||
                'Resolved log entries will be permanently removed. Entries still waiting for review are kept.'}
            </p>

            {maintenanceError && (
              <div className="alert alert-error">
                <XCircle size={17} />
                <span>{maintenanceError}</span>
              </div>
            )}

            <div className="confirm-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setMaintenanceOpen(false);
                  setMaintenanceError('');
                }}
                disabled={maintenanceBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleMaintenance}
                disabled={maintenanceBusy}
              >
                {maintenanceBusy && <Loader2 size={16} className="spin" />}
                {maintenanceBusy ? 'Cleaning…' : 'Clean log'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

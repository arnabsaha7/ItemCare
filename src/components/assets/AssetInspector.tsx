import {
  Box,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  FileText,
  FolderOpen,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import type {
  AssetRecord,
  DocumentWithLinks,
  MaintenanceHistoryRecord,
  MaintenanceTaskRecord,
  WarrantyRecord,
} from '@/src/types/homevault';
import {
  evaluateMaintenanceTask,
  evaluateWarranty,
  formatDate,
  formatINR,
  todayIsoDate,
} from '@/src/utils/format';
import { copyTextNative, sendDesktopNotification } from '@/src/services/tauri/bridge';
import { homeVaultService } from '@/src/services/database/homeVaultService';

interface AssetInspectorProps {
  asset: AssetRecord | null;
  warranties: WarrantyRecord[];
  tasks: MaintenanceTaskRecord[];
  history: MaintenanceHistoryRecord[];
  documents: DocumentWithLinks[];
  warrantyAlertDays: number;
  onEditAsset: (asset: AssetRecord) => void;
  onDeleteAsset: (assetId: string) => void;
  onOpenDocument: (doc: DocumentWithLinks, pageNumber?: number) => void;
  onRefresh: () => Promise<void>;
}

type InspectorTab = 'overview' | 'warranty' | 'maintenance' | 'vault';

export function AssetInspector({
  asset,
  warranties,
  tasks,
  history,
  documents,
  warrantyAlertDays,
  onEditAsset,
  onDeleteAsset,
  onOpenDocument,
  onRefresh,
}: AssetInspectorProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('overview');
  const [copiedSerial, setCopiedSerial] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [completionCost, setCompletionCost] = useState<string>('0');
  const [completionNotes, setCompletionNotes] = useState<string>('');
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!asset) {
    return (
      <aside className="w-[380px] shrink-0 h-full bg-hv-card border-l border-hv-border flex flex-col items-center justify-center p-8 text-center">
        <Box className="w-8 h-8 text-hv-muted/60 mb-3" />
        <div className="text-[14px] font-semibold text-hv-text">
          No Asset Selected
        </div>
        <p className="text-[12.5px] text-hv-muted mt-1">
          Select an asset from the workspace to inspect warranty coverage, maintenance schedules, and linked vault documents.
        </p>
      </aside>
    );
  }

  const assetWarranties = warranties.filter((w) => w.assetId === asset.id);
  const primaryWarranty = assetWarranties[0] ?? null;
  const wEval = evaluateWarranty(primaryWarranty, warrantyAlertDays);

  const assetTasks = tasks.filter((t) => t.assetId === asset.id);
  const assetHistory = history.filter((h) => h.assetId === asset.id);
  const assetDocs = documents.filter((d) => d.linkedAssetIds.includes(asset.id));

  const handleCopySerial = async () => {
    if (!asset.serialNumber) return;
    await copyTextNative(asset.serialNumber);
    setCopiedSerial(true);
    setTimeout(() => setCopiedSerial(false), 1600);
  };

  const handleMarkCompleted = async (task: MaintenanceTaskRecord) => {
    setBusyTask(task.id);
    try {
      const costVal = completingTaskId === task.id ? Number(completionCost) || 0 : task.estimatedCost;
      const notesVal =
        completingTaskId === task.id && completionNotes.trim()
          ? completionNotes.trim()
          : `Completed ${task.taskName} on schedule.`;
      await homeVaultService.completeMaintenanceTask({
        taskId: task.id,
        completedDate: todayIsoDate(),
        cost: costVal,
        serviceProviderName: task.serviceProviderName,
        notes: notesVal,
      });
      await sendDesktopNotification(
        'HomeVault Maintenance Logged',
        `${task.taskName} for ${asset.name} marked completed.`
      );
      setCompletingTaskId(null);
      setCompletionCost('0');
      setCompletionNotes('');
      await onRefresh();
    } finally {
      setBusyTask(null);
    }
  };

  return (
    <aside className="w-[380px] shrink-0 h-full bg-hv-card border-l border-hv-border flex flex-col overflow-hidden">
      {/* Header Summary */}
      <div className="p-4 border-b border-hv-border">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11.5px] text-hv-muted truncate">
              {asset.brand} <span aria-hidden="true">·</span> {asset.model || 'Standard'}
            </div>
            <h2 className="text-[16px] font-semibold text-hv-text leading-snug mt-0.5">
              {asset.name}
            </h2>
            <div className="text-[12px] text-hv-muted mt-1">
              {asset.locationName} <span aria-hidden="true">·</span> {asset.categoryName}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onEditAsset(asset)}
              title="Edit asset"
              className="p-1.5 rounded-md text-hv-muted hover:text-hv-text hover:bg-hv-hover transition-colors"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                title="Delete asset"
                className="p-1.5 rounded-md text-hv-muted hover:text-hv-danger hover:bg-hv-danger/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(false);
                  onDeleteAsset(asset.id);
                }}
                className="px-2 py-1 rounded-md bg-hv-danger-btn text-white text-[11px] font-medium"
              >
                Confirm
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-3.5 grid grid-cols-4 gap-1 p-1 rounded-lg bg-hv-sidebar">
          {(
            [
              { id: 'overview', label: 'Overview' },
              { id: 'warranty', label: 'Warranty' },
              { id: 'maintenance', label: 'Maint.' },
              { id: 'vault', label: 'Vault' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`py-1.5 px-2 rounded-md text-[12px] font-medium transition-colors whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-hv-card text-hv-text shadow-2xs'
                  : 'text-hv-muted hover:text-hv-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inspector Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {activeTab === 'overview' && (
          <>
            {asset.photoPath && (
              <div className="aspect-[16/10] w-full rounded-xl overflow-hidden border border-hv-border bg-hv-elevated">
                <img
                  src={asset.photoPath}
                  alt={asset.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="space-y-3">
              <div className="text-[11.5px] font-semibold text-hv-muted">
                Asset Identification & Purchase
              </div>

              <dl className="divide-y divide-hv-border text-[13px]">
                <div className="py-2 flex items-center justify-between gap-2">
                  <dt className="text-hv-muted">Serial Number</dt>
                  <dd className="flex items-center gap-1.5 font-mono text-[12px] text-hv-text">
                    <span>{asset.serialNumber || '—'}</span>
                    {asset.serialNumber && (
                      <button
                        type="button"
                        onClick={() => void handleCopySerial()}
                        title="Copy serial number"
                        className="p-1 rounded hover:bg-hv-hover text-hv-muted"
                      >
                        {copiedSerial ? (
                          <Check className="w-3.5 h-3.5 text-hv-success" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </dd>
                </div>

                <div className="py-2 flex items-center justify-between gap-2">
                  <dt className="text-hv-muted">Purchase Date</dt>
                  <dd className="font-medium text-hv-text tabular-nums">
                    {formatDate(asset.purchaseDate)}
                  </dd>
                </div>

                <div className="py-2 flex items-center justify-between gap-2">
                  <dt className="text-hv-muted">Retailer</dt>
                  <dd className="font-medium text-hv-text text-right">
                    {asset.retailer || '—'}
                  </dd>
                </div>

                <div className="py-2 flex items-center justify-between gap-2">
                  <dt className="text-hv-muted">Purchase Price</dt>
                  <dd className="font-semibold text-hv-text tabular-nums">
                    {formatINR(asset.purchasePrice, asset.currency)}
                  </dd>
                </div>

                <div className="py-2 flex items-center justify-between gap-2">
                  <dt className="text-hv-muted">Total Cost of Ownership</dt>
                  <dd className="font-semibold text-hv-accent-fg tabular-nums">
                    {formatINR(asset.totalCostOfOwnership, asset.currency)}
                  </dd>
                </div>

                {asset.invoiceNumber && (
                  <div className="py-2 flex items-center justify-between gap-2">
                    <dt className="text-hv-muted">Invoice Number</dt>
                    <dd className="font-mono text-[12px] text-hv-text">
                      {asset.invoiceNumber}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {asset.description && (
              <div className="pt-2 border-t border-hv-border">
                <div className="text-[11.5px] font-semibold text-hv-muted mb-1">
                  Notes
                </div>
                <p className="text-[12.5px] text-hv-text/85 leading-relaxed">
                  {asset.description}
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === 'warranty' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-semibold text-hv-muted">
                Warranty Coverage
              </div>
              <span
                className={`text-[12px] font-semibold ${
                  wEval.health === 'active'
                    ? 'text-hv-success'
                    : wEval.health === 'expiring_soon'
                    ? 'text-hv-warning'
                    : wEval.health === 'expired'
                    ? 'text-hv-danger'
                    : 'text-hv-muted'
                }`}
              >
                {wEval.label}
              </span>
            </div>

            {assetWarranties.length === 0 ? (
              <div className="p-4 rounded-xl bg-hv-subtle border border-hv-border text-[12.5px] text-hv-muted">
                No warranty records attached to this asset. Edit the asset to add coverage details.
              </div>
            ) : (
              assetWarranties.map((w) => (
                <div
                  key={w.id}
                  className="p-3.5 rounded-xl bg-hv-subtle border border-hv-border space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-semibold text-[13.5px] text-hv-text">
                      <ShieldCheck className="w-4 h-4 text-hv-accent-fg" />
                      <span>{w.provider}</span>
                    </div>
                    <span className="text-[11.5px] text-hv-muted">
                      {w.warrantyType}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-[12px]">
                    <div>
                      <dt className="text-hv-muted">Start Date</dt>
                      <dd className="font-medium text-hv-text tabular-nums">
                        {formatDate(w.startDate)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-hv-muted">Expiry Date</dt>
                      <dd className="font-medium text-hv-text tabular-nums">
                        {formatDate(w.expiryDate)}
                      </dd>
                    </div>
                  </dl>
                  {w.extendedDetails && (
                    <p className="text-[12px] text-hv-muted">
                      {w.extendedDetails}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="space-y-4">
            <div className="text-[12px] font-semibold text-hv-muted">
              Scheduled Maintenance Tasks
            </div>

            {assetTasks.length === 0 ? (
              <div className="p-4 rounded-xl bg-hv-subtle border border-hv-border text-[12.5px] text-hv-muted">
                No maintenance tasks scheduled for this asset yet.
              </div>
            ) : (
              assetTasks.map((task) => {
                const tEval = evaluateMaintenanceTask(task);
                const isExpanded = completingTaskId === task.id;
                return (
                  <div
                    key={task.id}
                    className="p-3.5 rounded-xl bg-hv-subtle border border-hv-border space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[13.5px] font-semibold text-hv-text">
                          {task.taskName}
                        </div>
                        <div className="text-[12px] text-hv-muted mt-0.5">
                          Every {task.frequencyDays} days
                          {task.sparePartNumber ? ` · Part SKU: ${task.sparePartNumber}` : ''}
                        </div>
                      </div>
                      <span
                        className={`text-[11.5px] font-semibold shrink-0 ${
                          tEval.health === 'overdue'
                            ? 'text-hv-danger'
                            : tEval.health === 'due_today'
                            ? 'text-hv-warning'
                            : 'text-hv-success'
                        }`}
                      >
                        {tEval.label}
                      </span>
                    </div>

                    <div className="text-[12px] text-hv-muted tabular-nums">
                      Next service: <span className="text-hv-text font-medium">{formatDate(task.nextServiceDate)}</span>
                      {task.lastServiceDate && ` · Last: ${formatDate(task.lastServiceDate)}`}
                    </div>

                    {task.instructions && (
                      <p className="text-[12px] text-hv-muted leading-relaxed">
                        {task.instructions}
                      </p>
                    )}

                    {isExpanded ? (
                      <div className="pt-2 border-t border-hv-border space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block text-[11px] text-hv-muted">
                            Service Cost (₹)
                            <input
                              type="number"
                              value={completionCost}
                              onChange={(e) => setCompletionCost(e.target.value)}
                              className="mt-1 w-full px-2.5 py-1.5 rounded-md bg-hv-card border border-hv-border-strong text-[12.5px] text-hv-text"
                            />
                          </label>
                          <label className="block text-[11px] text-hv-muted">
                            Notes
                            <input
                              type="text"
                              placeholder="Optional service note"
                              value={completionNotes}
                              onChange={(e) => setCompletionNotes(e.target.value)}
                              className="mt-1 w-full px-2.5 py-1.5 rounded-md bg-hv-card border border-hv-border-strong text-[12.5px] text-hv-text"
                            />
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={busyTask === task.id}
                            onClick={() => void handleMarkCompleted(task)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-hv-success-btn hover:opacity-90 text-white text-[12px] font-medium transition-opacity"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Save & Mark Completed</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCompletingTaskId(null)}
                            className="py-1.5 px-2.5 rounded-lg text-[12px] text-hv-muted hover:text-hv-text"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={busyTask === task.id}
                          onClick={() => void handleMarkCompleted(task)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-hv-accent hover:bg-hv-accent-hover text-white text-[12px] font-medium transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Mark Completed</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCompletionCost(String(task.estimatedCost || 0));
                            setCompletingTaskId(task.id);
                          }}
                          className="py-1.5 px-2.5 rounded-lg bg-hv-card border border-hv-border-strong text-[12px] font-medium text-hv-text hover:bg-hv-hover"
                        >
                          With Cost
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {assetHistory.length > 0 && (
              <div className="pt-2 space-y-2">
                <div className="text-[12px] font-semibold text-hv-muted">
                  Service History
                </div>
                <div className="divide-y divide-hv-border rounded-xl border border-hv-border">
                  {assetHistory.map((h) => (
                    <div key={h.id} className="p-3 text-[12px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-hv-text">
                          {h.taskName}
                        </span>
                        <span className="font-semibold tabular-nums text-hv-text">
                          {formatINR(h.cost)}
                        </span>
                      </div>
                      <div className="text-hv-muted mt-0.5 tabular-nums">
                        {formatDate(h.completedDate)} · {h.serviceProviderName || 'Self'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'vault' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-hv-muted">
                Linked Vault Documents ({assetDocs.length})
              </span>
            </div>

            {assetDocs.length === 0 ? (
              <div className="p-4 rounded-xl bg-hv-subtle border border-hv-border text-[12.5px] text-hv-muted">
                No documents linked yet. Import manuals, invoices, or serial photos from Documents & Vault.
              </div>
            ) : (
              <div className="space-y-2">
                {assetDocs.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => onOpenDocument(doc, doc.fileName.includes('Bosch') ? 34 : 1)}
                    className="w-full text-left p-3 rounded-xl bg-hv-subtle border border-hv-border hover:border-hv-accent-fg/60 transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-hv-accent-fg shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-hv-text truncate">
                          {doc.title}
                        </div>
                        <div className="text-[11.5px] text-hv-muted truncate flex items-center gap-1.5">
                          <span>
                            {doc.category} · {doc.pageCount}p
                          </span>
                          {doc.integrityStatus === 'modified' && (
                            <span className="inline-flex items-center gap-0.5 text-hv-warning font-medium">
                              · <ShieldAlert className="w-3 h-3" /> Modified
                            </span>
                          )}
                          {(doc.isMissing || doc.integrityStatus === 'missing') && (
                            <span className="text-hv-danger font-medium">· Missing</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <FolderOpen className="w-3.5 h-3.5 text-hv-muted shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

import { Calendar, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  AssetRecord,
  MaintenanceHistoryRecord,
  MaintenanceTaskRecord,
  TaskPriority,
} from '@/src/types/homevault';
import {
  addDaysIso,
  evaluateMaintenanceTask,
  formatDate,
  formatINR,
  todayIsoDate,
} from '@/src/utils/format';
import { homeVaultService } from '@/src/services/database/homeVaultService';

interface MaintenanceCenterViewProps {
  assets: AssetRecord[];
  tasks: MaintenanceTaskRecord[];
  history: MaintenanceHistoryRecord[];
  onSelectAsset: (assetId: string) => void;
  onRefresh: () => Promise<void>;
}

type MaintTab = 'today' | 'upcoming' | 'overdue' | 'completed' | 'all';

export function MaintenanceCenterView({
  assets,
  tasks,
  history,
  onSelectAsset,
  onRefresh,
}: MaintenanceCenterViewProps) {
  const [tab, setTab] = useState<MaintTab>('all');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    assetId: assets[0]?.id ?? '',
    taskName: '',
    nextServiceDate: todayIsoDate(),
    frequencyDays: '90',
    priority: 'Medium' as TaskPriority,
    serviceProviderName: '',
    sparePartNumber: '',
    estimatedCost: '0',
    notes: '',
  });

  const assetMap = useMemo(() => {
    const m = new Map<string, AssetRecord>();
    assets.forEach((a) => m.set(a.id, a));
    return m;
  }, [assets]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const ev = evaluateMaintenanceTask(t);
      if (tab === 'today') return ev.health === 'due_today';
      if (tab === 'upcoming') return ev.health === 'upcoming';
      if (tab === 'overdue') return ev.health === 'overdue';
      return true;
    });
  }, [tasks, tab]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.assetId || !form.taskName.trim()) return;
    await homeVaultService.upsertMaintenanceTask({
      assetId: form.assetId,
      taskName: form.taskName.trim(),
      maintenanceRequired: true,
      frequencyDays: Number(form.frequencyDays) || 90,
      lastServiceDate: null,
      nextServiceDate: form.nextServiceDate,
      priority: form.priority,
      serviceProviderName: form.serviceProviderName,
      sparePartNumber: form.sparePartNumber,
      estimatedCost: Number(form.estimatedCost) || 0,
      instructions: '',
      notes: form.notes,
    });
    setAdding(false);
    setForm({ ...form, taskName: '', notes: '' });
    await onRefresh();
  };

  const handleComplete = async (t: MaintenanceTaskRecord) => {
    await homeVaultService.completeMaintenanceTask({
      taskId: t.id,
      completedDate: todayIsoDate(),
      cost: t.estimatedCost,
      serviceProviderName: t.serviceProviderName,
      notes: `Completed via Maintenance Center`,
    });
    await onRefresh();
  };

  const handleReschedule = async (t: MaintenanceTaskRecord, days: number) => {
    await homeVaultService.upsertMaintenanceTask({
      id: t.id,
      assetId: t.assetId,
      taskName: t.taskName,
      maintenanceRequired: t.maintenanceRequired,
      frequencyDays: t.frequencyDays,
      lastServiceDate: t.lastServiceDate,
      nextServiceDate: addDaysIso(t.nextServiceDate, days),
      priority: t.priority,
      serviceProviderName: t.serviceProviderName,
      sparePartNumber: t.sparePartNumber,
      estimatedCost: t.estimatedCost,
      instructions: t.instructions,
      notes: t.notes,
    });
    await onRefresh();
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-hv-text">
            Maintenance Center
          </h1>
          <p className="text-[13px] text-hv-muted mt-0.5">
            Schedule recurring appliance care, log service expenses, and keep Total Cost of Ownership up to date.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-hv-accent hover:bg-hv-accent-hover text-white text-[13px] font-medium"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Task</span>
        </button>
      </div>

      {adding && (
        <form
          onSubmit={(e) => void handleAddTask(e)}
          className="p-4 rounded-xl bg-hv-card border border-hv-accent/35 grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          <select
            value={form.assetId}
            onChange={(e) => setForm({ ...form, assetId: e.target.value })}
            className={inputCls}
          >
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <input
            required
            placeholder="Task Name (e.g., Descale Boiler)"
            value={form.taskName}
            onChange={(e) => setForm({ ...form, taskName: e.target.value })}
            className={inputCls}
          />
          <input
            type="date"
            value={form.nextServiceDate}
            onChange={(e) => setForm({ ...form, nextServiceDate: e.target.value })}
            className={inputCls}
          />
          <input
            type="number"
            placeholder="Frequency (days)"
            value={form.frequencyDays}
            onChange={(e) => setForm({ ...form, frequencyDays: e.target.value })}
            className={inputCls}
          />
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
            className={inputCls}
          >
            <option value="Low">Low Priority</option>
            <option value="Medium">Medium Priority</option>
            <option value="High">High Priority</option>
            <option value="Critical">Critical Priority</option>
          </select>
          <input
            type="number"
            placeholder="Estimated Cost (₹)"
            value={form.estimatedCost}
            onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })}
            className={inputCls}
          />
          <input
            placeholder="Service Provider"
            value={form.serviceProviderName}
            onChange={(e) => setForm({ ...form, serviceProviderName: e.target.value })}
            className={inputCls}
          />
          <input
            placeholder="Spare Part SKU"
            value={form.sparePartNumber}
            onChange={(e) => setForm({ ...form, sparePartNumber: e.target.value })}
            className={inputCls}
          />
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="px-3 py-1.5 text-[12.5px] text-hv-muted hover:text-hv-text">
              Cancel
            </button>
            <button type="submit" className="px-4 py-1.5 rounded-lg bg-hv-accent hover:bg-hv-accent-hover text-white text-[12.5px] font-medium">
              Create Task
            </button>
          </div>
        </form>
      )}

      {/* Segmented Tabs */}
      <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-hv-sidebar">
        {(
          [
            { id: 'today', label: 'Today' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'overdue', label: 'Overdue' },
            { id: 'completed', label: 'Completed' },
            { id: 'all', label: 'All Tasks' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-colors whitespace-nowrap ${
              tab === t.id
                ? 'bg-hv-card text-hv-text shadow-2xs'
                : 'text-hv-muted hover:text-hv-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'completed' ? (
        <div className="bg-hv-card border border-hv-border rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-hv-border bg-hv-subtle text-[11.5px] font-semibold text-hv-muted">
                <th className="py-2.5 px-4">Service Completed</th>
                <th className="py-2.5 px-3">Asset</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Provider</th>
                <th className="py-2.5 px-4 text-right">Expense</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hv-border text-[13px]">
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="py-2.5 px-4 font-medium text-hv-text">
                    {h.taskName}
                    {h.notes && (
                      <div className="text-[11.5px] text-hv-muted font-normal">
                        {h.notes}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-hv-text">
                    {assetMap.get(h.assetId)?.name ?? 'Asset'}
                  </td>
                  <td className="py-2.5 px-3 tabular-nums text-hv-muted">
                    {formatDate(h.completedDate)}
                  </td>
                  <td className="py-2.5 px-3 text-hv-muted">
                    {h.serviceProviderName || 'Self'}
                  </td>
                  <td className="py-2.5 px-4 text-right font-semibold tabular-nums text-hv-text">
                    {formatINR(h.cost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-hv-card border border-hv-border rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-hv-border bg-hv-subtle text-[11.5px] font-semibold text-hv-muted">
                <th className="py-2.5 px-4">Task</th>
                <th className="py-2.5 px-3">Asset</th>
                <th className="py-2.5 px-3">Due Date</th>
                <th className="py-2.5 px-3">Cadence & Priority</th>
                <th className="py-2.5 px-3">Est. Cost</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hv-border text-[13px]">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-hv-muted">
                    No maintenance tasks in this view.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((t) => {
                  const asset = assetMap.get(t.assetId);
                  const ev = evaluateMaintenanceTask(t);
                  return (
                    <tr key={t.id} className="hover:bg-hv-subtle">
                      <td className="py-3 px-4">
                        <div className="font-medium text-hv-text">
                          {t.taskName}
                        </div>
                        <div className="text-[11.5px] text-hv-muted">
                          {t.serviceProviderName || 'Self'}
                          {t.sparePartNumber ? ` · Part: ${t.sparePartNumber}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() => asset && onSelectAsset(asset.id)}
                          className="text-left text-hv-text hover:text-hv-accent-fg font-medium"
                        >
                          {asset?.name ?? 'Unknown Asset'}
                        </button>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="tabular-nums text-hv-text">
                          {formatDate(t.nextServiceDate)}
                        </div>
                        <div
                          className={`text-[11.5px] font-medium ${
                            ev.health === 'overdue'
                              ? 'text-hv-danger'
                              : ev.health === 'due_today'
                              ? 'text-hv-warning'
                              : 'text-hv-success'
                          }`}
                        >
                          {ev.label}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-hv-muted">
                        Every {t.frequencyDays}d · {t.priority}
                      </td>
                      <td className="py-3 px-3 tabular-nums text-hv-text">
                        {formatINR(t.estimatedCost)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleComplete(t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-hv-accent hover:bg-hv-accent-hover text-white text-[11.5px] font-medium"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Mark Completed</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleReschedule(t, 7)}
                            title="Postpone by 7 days"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-hv-elevated hover:bg-hv-hover text-[11.5px] text-hv-text"
                          >
                            <Calendar className="w-3 h-3" />
                            <span>+7d</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void homeVaultService.deleteMaintenanceTask(t.id).then(onRefresh)}
                            title="Delete task"
                            className="p-1.5 rounded-md text-hv-muted hover:text-hv-danger"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const inputCls =
  'w-full px-3 py-1.5 rounded-lg bg-hv-subtle border border-hv-border-strong text-[13px] text-hv-text focus:outline-none focus:ring-2 focus:ring-hv-accent/40 focus:border-hv-accent';

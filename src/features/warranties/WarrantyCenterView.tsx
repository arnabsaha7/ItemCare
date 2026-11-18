import { Download, Plus, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AssetRecord, WarrantyRecord, WarrantyType } from '@/src/types/homevault';
import { addDaysIso, evaluateWarranty, formatDate, formatINR, todayIsoDate } from '@/src/utils/format';
import { homeVaultService } from '@/src/services/database/homeVaultService';

interface WarrantyCenterViewProps {
  assets: AssetRecord[];
  warranties: WarrantyRecord[];
  warrantyAlertDays: number;
  onSelectAsset: (assetId: string) => void;
  onOpenInsuranceExport: () => void;
  onRefresh: () => Promise<void>;
}

type WarrantyViewTab = 'active' | 'expiring' | 'expired' | 'extended';

export function WarrantyCenterView({
  assets,
  warranties,
  warrantyAlertDays,
  onSelectAsset,
  onOpenInsuranceExport,
  onRefresh,
}: WarrantyCenterViewProps) {
  const [tab, setTab] = useState<WarrantyViewTab>('active');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    assetId: assets[0]?.id ?? '',
    provider: '',
    startDate: todayIsoDate(),
    expiryDate: addDaysIso(todayIsoDate(), 365),
    durationMonths: '12',
    warrantyType: 'Manufacturer' as WarrantyType,
    extendedDetails: '',
  });

  const assetMap = useMemo(() => {
    const m = new Map<string, AssetRecord>();
    assets.forEach((a) => m.set(a.id, a));
    return m;
  }, [assets]);

  const stats = useMemo(() => {
    let active = 0;
    let expiring = 0;
    let expired = 0;
    let coveredValuation = 0;
    const seenAssets = new Set<string>();

    for (const w of warranties) {
      const ev = evaluateWarranty(w, warrantyAlertDays);
      const asset = assetMap.get(w.assetId);
      if (ev.health === 'expiring_soon') {
        expiring += 1;
        active += 1;
        if (asset && !seenAssets.has(asset.id)) {
          coveredValuation += asset.purchasePrice;
          seenAssets.add(asset.id);
        }
      } else if (ev.health === 'active') {
        active += 1;
        if (asset && !seenAssets.has(asset.id)) {
          coveredValuation += asset.purchasePrice;
          seenAssets.add(asset.id);
        }
      } else if (ev.health === 'expired') {
        expired += 1;
      }
    }

    return { active, expiring, expired, coveredValuation };
  }, [warranties, assetMap, warrantyAlertDays]);

  const filteredWarranties = useMemo(() => {
    return warranties.filter((w) => {
      const ev = evaluateWarranty(w, warrantyAlertDays);
      if (tab === 'active') return ev.health === 'active' || ev.health === 'expiring_soon';
      if (tab === 'expiring') return ev.health === 'expiring_soon';
      if (tab === 'expired') return ev.health === 'expired';
      return w.warrantyType === 'Extended Care' || w.warrantyType === 'AppleCare+';
    });
  }, [warranties, tab, warrantyAlertDays]);

  const handleAddWarranty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.assetId || !form.provider.trim()) return;
    await homeVaultService.upsertWarranty({
      assetId: form.assetId,
      provider: form.provider.trim(),
      startDate: form.startDate,
      expiryDate: form.expiryDate,
      durationMonths: Number(form.durationMonths) || 12,
      warrantyType: form.warrantyType,
      extendedDetails: form.extendedDetails,
    });
    setAdding(false);
    setForm({ ...form, provider: '', extendedDetails: '' });
    await onRefresh();
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-hv-text">
            Insurance & Warranty Center
          </h1>
          <p className="text-[13px] text-hv-muted mt-0.5">
            Track manufacturer coverage, extended protection timelines, and insured household valuation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-hv-card border border-hv-border-strong text-[13px] font-medium text-hv-text hover:bg-hv-elevated"
          >
            <Plus className="w-4 h-4 text-hv-accent-fg" />
            <span>Add Warranty</span>
          </button>
          <button
            type="button"
            onClick={onOpenInsuranceExport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-hv-accent hover:bg-hv-accent-hover text-white text-[13px] font-medium"
          >
            <Download className="w-4 h-4" />
            <span>Export Insurance Pack</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatBox label="Active Warranties" value={String(stats.active)} tone="success" />
        <StatBox label={`Expiring Within ${warrantyAlertDays} Days`} value={String(stats.expiring)} tone="warning" />
        <StatBox label="Expired" value={String(stats.expired)} tone="danger" />
        <StatBox label="Covered Asset Valuation" value={formatINR(stats.coveredValuation)} tone="neutral" />
      </div>

      {adding && (
        <form
          onSubmit={(e) => void handleAddWarranty(e)}
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
            placeholder="Warranty Provider"
            value={form.provider}
            onChange={(e) => setForm({ ...form, provider: e.target.value })}
            className={inputCls}
          />
          <select
            value={form.warrantyType}
            onChange={(e) => setForm({ ...form, warrantyType: e.target.value as WarrantyType })}
            className={inputCls}
          >
            <option value="Manufacturer">Manufacturer</option>
            <option value="Extended Care">Extended Care</option>
            <option value="AppleCare+">AppleCare+</option>
            <option value="Retailer Plan">Retailer Plan</option>
          </select>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className={inputCls}
          />
          <input
            type="date"
            value={form.expiryDate}
            onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
            className={inputCls}
          />
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="px-3 py-1.5 text-[12.5px] text-hv-muted hover:text-hv-text">
              Cancel
            </button>
            <button type="submit" className="px-4 py-1.5 rounded-lg bg-hv-accent hover:bg-hv-accent-hover text-white text-[12.5px] font-medium">
              Save Warranty
            </button>
          </div>
        </form>
      )}

      {/* Segmented Tabs */}
      <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-hv-sidebar">
        {(
          [
            { id: 'active', label: 'Active' },
            { id: 'expiring', label: 'Expiring Soon' },
            { id: 'expired', label: 'Expired' },
            { id: 'extended', label: 'Extended Warranty' },
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

      {/* Warranty List */}
      <div className="bg-hv-card border border-hv-border rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-hv-border bg-hv-subtle text-[11.5px] font-semibold text-hv-muted">
              <th className="py-2.5 px-4">Asset</th>
              <th className="py-2.5 px-3">Provider & Plan</th>
              <th className="py-2.5 px-3">Start</th>
              <th className="py-2.5 px-3">Expiry</th>
              <th className="py-2.5 px-3">Coverage Timeline</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hv-border text-[13px]">
            {filteredWarranties.map((w) => {
              const asset = assetMap.get(w.assetId);
              const ev = evaluateWarranty(w, warrantyAlertDays);
              const totalDays = Math.max(1, w.durationMonths * 30);
              const pctRemaining = Math.max(0, Math.min(100, Math.round((ev.daysLeft / totalDays) * 100)));

              return (
                <tr key={w.id} className="hover:bg-hv-subtle">
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => asset && onSelectAsset(asset.id)}
                      className="text-left font-medium text-hv-text hover:text-hv-accent-fg"
                    >
                      {asset?.name ?? 'Unknown Asset'}
                    </button>
                    <div className="text-[11.5px] text-hv-muted tabular-nums">
                      {asset ? `${asset.locationName} · ${formatINR(asset.purchasePrice)}` : ''}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-medium text-hv-text">{w.provider}</div>
                    <div className="text-[11.5px] text-hv-muted">{w.warrantyType}</div>
                  </td>
                  <td className="py-3 px-3 tabular-nums text-hv-muted whitespace-nowrap">
                    {formatDate(w.startDate)}
                  </td>
                  <td className="py-3 px-3 tabular-nums text-hv-text whitespace-nowrap">
                    {formatDate(w.expiryDate)}
                  </td>
                  <td className="py-3 px-3 min-w-[180px]">
                    <div className="flex items-center gap-1.5 text-[12px] font-medium mb-1">
                      {ev.health === 'active' ? (
                        <ShieldCheck className="w-3.5 h-3.5 text-hv-success" />
                      ) : (
                        <ShieldAlert
                          className={`w-3.5 h-3.5 ${
                            ev.health === 'expiring_soon' ? 'text-hv-warning' : 'text-hv-danger'
                          }`}
                        />
                      )}
                      <span
                        className={
                          ev.health === 'active'
                            ? 'text-hv-success'
                            : ev.health === 'expiring_soon'
                            ? 'text-hv-warning'
                            : 'text-hv-danger'
                        }
                      >
                        {ev.label}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-hv-elevated overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          ev.health === 'active'
                            ? 'bg-hv-success'
                            : ev.health === 'expiring_soon'
                            ? 'bg-hv-warning'
                            : 'bg-hv-danger'
                        }`}
                        style={{ width: `${ev.health === 'expired' ? 0 : Math.max(6, pctRemaining)}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => void homeVaultService.deleteWarranty(w.id).then(onRefresh)}
                      title="Delete warranty"
                      className="p-1.5 rounded-md text-hv-muted hover:text-hv-danger"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
}) {
  const color =
    tone === 'success'
      ? 'text-hv-success'
      : tone === 'warning'
      ? 'text-hv-warning'
      : tone === 'danger'
      ? 'text-hv-danger'
      : 'text-hv-text';
  return (
    <div className="bg-hv-card border border-hv-border rounded-xl px-4 py-3">
      <div className="text-[12px] text-hv-muted">{label}</div>
      <div className={`text-[20px] font-semibold tabular-nums mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}

const inputCls =
  'w-full px-3 py-1.5 rounded-lg bg-hv-subtle border border-hv-border-strong text-[13px] text-hv-text focus:outline-none focus:ring-2 focus:ring-hv-accent/40 focus:border-hv-accent';

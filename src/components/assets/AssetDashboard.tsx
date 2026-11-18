import {
  ArrowUpDown,
  BookOpen,
  Box,
  Download,
  Filter,
  FolderOpen,
  LayoutGrid,
  List,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  AssetRecord,
  MaintenanceTaskRecord,
  SmartViewType,
  WarrantyRecord,
} from '@/src/types/homevault';
import {
  evaluateMaintenanceTask,
  evaluateWarranty,
  formatDate,
  formatINR,
} from '@/src/utils/format';

interface AssetDashboardProps {
  assets: AssetRecord[];
  warranties: WarrantyRecord[];
  maintenanceTasks: MaintenanceTaskRecord[];
  warrantyAlertDays: number;
  selectedAssetId: string | null;
  onSelectAsset: (assetId: string) => void;
  smartView: SmartViewType;
  roomFilter: string | null;
  onAddAsset: () => void;
  onOpenInsuranceExport: () => void;
  onOpenOnboarding?: () => void;
  onLoadSampleData?: () => Promise<void>;
  onOpenVault?: () => void;
}

type StatusTab = 'all' | 'active' | 'expiring' | 'in_repair';
type SortOption = 'featured' | 'price_desc' | 'price_asc' | 'name_asc' | 'newest';

export function AssetDashboard({
  assets,
  warranties,
  maintenanceTasks,
  warrantyAlertDays,
  selectedAssetId,
  onSelectAsset,
  smartView,
  roomFilter,
  onAddAsset,
  onOpenInsuranceExport,
  onOpenOnboarding,
  onLoadSampleData,
  onOpenVault,
}: AssetDashboardProps) {
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  const warrantyByAsset = useMemo(() => {
    const map = new Map<string, WarrantyRecord>();
    for (const w of warranties) {
      const prev = map.get(w.assetId);
      if (!prev || w.expiryDate > prev.expiryDate) {
        map.set(w.assetId, w);
      }
    }
    return map;
  }, [warranties]);

  const dueTaskByAsset = useMemo(() => {
    const map = new Map<string, MaintenanceTaskRecord>();
    for (const t of maintenanceTasks) {
      const h = evaluateMaintenanceTask(t).health;
      if (h === 'due_today' || h === 'overdue') {
        map.set(t.assetId, t);
      }
    }
    return map;
  }, [maintenanceTasks]);

  const categories = useMemo(() => {
    const set = new Set(assets.map((a) => a.categoryName));
    return ['All', ...Array.from(set).sort()];
  }, [assets]);

  const filteredAssets = useMemo(() => {
    let list = [...assets];

    if (roomFilter) {
      list = list.filter((a) => a.locationName === roomFilter);
    } else if (smartView === 'expiring') {
      list = list.filter((a) => {
        const w = warrantyByAsset.get(a.id);
        return evaluateWarranty(w, warrantyAlertDays).health === 'expiring_soon';
      });
    } else if (smartView === 'maintenance_due') {
      list = list.filter((a) => dueTaskByAsset.has(a.id));
    } else if (smartView === 'in_repair') {
      list = list.filter((a) => a.status === 'in_repair');
    } else if (smartView === 'recent') {
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    if (statusTab === 'active') {
      list = list.filter((a) => a.status === 'active');
    } else if (statusTab === 'expiring') {
      list = list.filter((a) => {
        const w = warrantyByAsset.get(a.id);
        return evaluateWarranty(w, warrantyAlertDays).health === 'expiring_soon';
      });
    } else if (statusTab === 'in_repair') {
      list = list.filter((a) => a.status === 'in_repair');
    }

    if (categoryFilter !== 'All') {
      list = list.filter((a) => a.categoryName === categoryFilter);
    }

    switch (sortBy) {
      case 'featured':
        list.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
        break;
      case 'price_desc':
        list.sort((a, b) => b.purchasePrice - a.purchasePrice);
        break;
      case 'price_asc':
        list.sort((a, b) => a.purchasePrice - b.purchasePrice);
        break;
      case 'name_asc':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'newest':
        list.sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
        break;
    }

    return list;
  }, [
    assets,
    roomFilter,
    smartView,
    statusTab,
    categoryFilter,
    sortBy,
    warrantyByAsset,
    dueTaskByAsset,
    warrantyAlertDays,
  ]);

  const viewTotals = useMemo(() => {
    const scopeAssets = roomFilter
      ? assets.filter((a) => a.locationName === roomFilter)
      : assets;
    const totalValuation = scopeAssets.reduce((sum, a) => sum + a.purchasePrice, 0);
    const activeWarranties = scopeAssets.filter((a) => {
      const h = evaluateWarranty(warrantyByAsset.get(a.id), warrantyAlertDays).health;
      return h === 'active' || h === 'expiring_soon';
    }).length;
    const expiringCount = scopeAssets.filter(
      (a) => evaluateWarranty(warrantyByAsset.get(a.id), warrantyAlertDays).health === 'expiring_soon'
    ).length;
    const maintDue = scopeAssets.filter((a) => dueTaskByAsset.has(a.id)).length;
    return {
      totalValuation,
      assetCount: scopeAssets.length,
      activeWarranties,
      expiringCount,
      maintDue,
    };
  }, [assets, roomFilter, warrantyByAsset, dueTaskByAsset, warrantyAlertDays]);

  const title = roomFilter
    ? roomFilter
    : smartView === 'expiring'
    ? 'Expiring Soon'
    : smartView === 'maintenance_due'
    ? 'Maintenance Due'
    : smartView === 'in_repair'
    ? 'In Repair'
    : smartView === 'recent'
    ? 'Recently Added'
    : 'All Assets';

  const subtitle = roomFilter
    ? `Registered household equipment and valuables in ${roomFilter}.`
    : 'Everything you own, organized in one place.';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Page Header & KPI Strip */}
      <div className="px-6 pt-5 pb-4 border-b border-hv-border bg-hv-bg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-hv-text">
              {title}
            </h1>
            <p className="text-[13px] text-hv-muted mt-0.5">{subtitle}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenInsuranceExport}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-hv-card border border-hv-border-strong text-[13px] font-medium text-hv-text hover:bg-hv-hover transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-hv-accent-fg" />
              <span>Export Insurance Pack</span>
            </button>
            <button
              type="button"
              onClick={onAddAsset}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-hv-accent hover:bg-hv-accent-hover text-white text-[13px] font-medium transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Add Asset</span>
            </button>
          </div>
        </div>

        {/* Summary Metrics Bar */}
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-hv-card border border-hv-border rounded-xl px-4 py-3">
            <div className="text-[12px] text-hv-muted">
              Total Insured Valuation
            </div>
            <div className="text-[20px] font-semibold text-hv-text tabular-nums mt-0.5">
              {formatINR(viewTotals.totalValuation)}
            </div>
          </div>

          <div className="bg-hv-card border border-hv-border rounded-xl px-4 py-3">
            <div className="text-[12px] text-hv-muted">Asset Count</div>
            <div className="text-[20px] font-semibold text-hv-text tabular-nums mt-0.5">
              {viewTotals.assetCount} items
            </div>
          </div>

          <div className="bg-hv-card border border-hv-border rounded-xl px-4 py-3">
            <div className="text-[12px] text-hv-muted">Warranty Summary</div>
            <div className="text-[14px] font-semibold text-hv-text tabular-nums mt-1.5 flex items-center gap-2">
              <span className="text-hv-success">{viewTotals.activeWarranties} active</span>
              <span className="text-hv-muted" aria-hidden="true">·</span>
              <span className={viewTotals.expiringCount > 0 ? 'text-hv-warning' : 'text-hv-muted'}>
                {viewTotals.expiringCount} expiring
              </span>
            </div>
          </div>

          <div className="bg-hv-card border border-hv-border rounded-xl px-4 py-3">
            <div className="text-[12px] text-hv-muted">
              Maintenance Summary
            </div>
            <div className="text-[14px] font-semibold text-hv-text tabular-nums mt-1.5 flex items-center gap-2">
              <span className={viewTotals.maintDue > 0 ? 'text-hv-warning' : 'text-hv-success'}>
                {viewTotals.maintDue} tasks due
              </span>
              <span className="text-hv-muted" aria-hidden="true">·</span>
              <span className="text-hv-muted font-normal">Local schedule</span>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-hv-sidebar border border-hv-border">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'active', label: 'Active' },
                { id: 'expiring', label: 'Expiring' },
                { id: 'in_repair', label: 'In Repair' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusTab(tab.id)}
                className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors whitespace-nowrap ${
                  statusTab === tab.id
                    ? 'bg-hv-card text-hv-text shadow-2xs'
                    : 'text-hv-muted hover:text-hv-text'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Category Filter */}
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-hv-card border border-hv-border-strong text-[12px] text-hv-muted">
              <Filter className="w-3.5 h-3.5 shrink-0" />
              <select
                aria-label="Filter by category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-transparent text-hv-text font-medium focus:outline-none cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c} value={c} className="bg-hv-card text-hv-text">
                    {c === 'All' ? 'All Categories' : c}
                  </option>
                ))}
              </select>
            </label>

            {/* Sort */}
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-hv-card border border-hv-border-strong text-[12px] text-hv-muted">
              <ArrowUpDown className="w-3.5 h-3.5 shrink-0" />
              <select
                aria-label="Sort assets"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-transparent text-hv-text font-medium focus:outline-none cursor-pointer"
              >
                <option value="featured" className="bg-hv-card text-hv-text">Featured First</option>
                <option value="price_desc" className="bg-hv-card text-hv-text">Value: High to Low</option>
                <option value="price_asc" className="bg-hv-card text-hv-text">Value: Low to High</option>
                <option value="name_asc" className="bg-hv-card text-hv-text">Name A–Z</option>
                <option value="newest" className="bg-hv-card text-hv-text">Purchase Date</option>
              </select>
            </label>

            {/* Grid/List Toggle */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-hv-card border border-hv-border-strong">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="Grid view"
                aria-label="Grid view"
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-hv-elevated text-hv-accent-fg'
                    : 'text-hv-muted hover:text-hv-text'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                title="List view"
                aria-label="List view"
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-hv-elevated text-hv-accent-fg'
                    : 'text-hv-muted hover:text-hv-text'
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {assets.length === 0 && !roomFilter && smartView === 'all' && statusTab === 'all' && categoryFilter === 'All' ? (
          <div className="max-w-3xl mx-auto bg-hv-card border border-hv-border rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="space-y-1.5">
              <h2 className="text-[18px] font-semibold text-hv-text">
                Your HomeVault is clean and ready
              </h2>
              <p className="text-[13px] text-hv-muted">
                Start building your private household inventory, warranty tracker, and structured document vault in three quick steps.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-left">
              <div className="p-4 rounded-xl bg-hv-subtle border border-hv-border space-y-1.5">
                <div className="text-[12px] font-semibold text-hv-accent-fg">1. Add an Asset</div>
                <p className="text-[12px] text-hv-muted leading-relaxed">
                  Register appliances, electronics, or vehicles with serial numbers and purchase price.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-hv-subtle border border-hv-border space-y-1.5">
                <div className="text-[12px] font-semibold text-hv-accent-fg">2. Store Documents</div>
                <p className="text-[12px] text-hv-muted leading-relaxed">
                  Save warranties, invoices, and manuals into structured folders with tamper tracking.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-hv-subtle border border-hv-border space-y-1.5">
                <div className="text-[12px] font-semibold text-hv-accent-fg">3. Track Care</div>
                <p className="text-[12px] text-hv-muted leading-relaxed">
                  Get local reminders before warranties expire or scheduled servicing falls due.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={onAddAsset}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-hv-accent hover:bg-hv-accent-hover text-white text-[13px] font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Asset</span>
              </button>
              {onOpenVault && (
                <button
                  type="button"
                  onClick={onOpenVault}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-hv-subtle border border-hv-border-strong text-[13px] font-medium text-hv-text hover:bg-hv-hover transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-hv-accent-fg" />
                  <span>Open Document Vault</span>
                </button>
              )}
              {onOpenOnboarding && (
                <button
                  type="button"
                  onClick={onOpenOnboarding}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-hv-subtle border border-hv-border-strong text-[13px] font-medium text-hv-text hover:bg-hv-hover transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5 text-hv-accent-fg" />
                  <span>Setup Guide</span>
                </button>
              )}
              {onLoadSampleData && (
                <button
                  type="button"
                  onClick={() => void onLoadSampleData()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-hv-border-strong text-[13px] font-medium text-hv-muted hover:text-hv-text hover:bg-hv-hover transition-colors ml-auto"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Load Sample Data</span>
                </button>
              )}
            </div>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-center bg-hv-card border border-hv-border rounded-xl p-8">
            <Box className="w-8 h-8 text-hv-muted mb-3" />
            <h2 className="text-[15px] font-semibold text-hv-text">
              No matching assets
            </h2>
            <p className="text-[13px] text-hv-muted mt-1 max-w-sm">
              Adjust your filter criteria or register a new household asset in this space.
            </p>
            <button
              type="button"
              onClick={onAddAsset}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-hv-accent hover:bg-hv-accent-hover text-white text-[13px] font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Asset</span>
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredAssets.map((asset) => {
              const warranty = warrantyByAsset.get(asset.id);
              const wEval = evaluateWarranty(warranty, warrantyAlertDays);
              const dueTask = dueTaskByAsset.get(asset.id);
              const isSelected = selectedAssetId === asset.id;

              const statusText = dueTask
                ? evaluateMaintenanceTask(dueTask).label
                : wEval.label;
              const statusColor = dueTask
                ? 'text-hv-warning'
                : wEval.health === 'active'
                ? 'text-hv-success'
                : wEval.health === 'expiring_soon'
                ? 'text-hv-warning'
                : wEval.health === 'expired'
                ? 'text-hv-danger'
                : 'text-hv-muted';

              return (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => onSelectAsset(asset.id)}
                  className={`text-left group bg-hv-card rounded-xl border transition-all overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hv-accent-fg ${
                    isSelected
                      ? 'border-hv-accent-fg ring-1 ring-hv-accent-fg/35 shadow-xs'
                      : 'border-hv-border hover:border-hv-border-strong'
                  }`}
                >
                  {/* Visual slot */}
                  <div className="aspect-[16/10] w-full bg-hv-elevated overflow-hidden border-b border-hv-border flex items-center justify-center">
                    {asset.photoPath ? (
                      <img
                        src={asset.photoPath}
                        alt={asset.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center px-4 text-center bg-gradient-to-br from-hv-bg to-hv-sidebar">
                        <Box className="w-7 h-7 text-hv-muted/60 mb-1.5" />
                        <span className="text-[11.5px] font-medium text-hv-muted truncate max-w-full">
                          {asset.brand} · {asset.model}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Content — Zero-pill clean typography */}
                  <div className="p-4">
                    <div className="text-[11.5px] text-hv-muted truncate">
                      {asset.locationName} <span aria-hidden="true">·</span> {asset.brand}
                    </div>
                    <h3 className="text-[14.5px] font-semibold text-hv-text mt-0.5 truncate">
                      {asset.name}
                    </h3>

                    <div className="mt-3 pt-2.5 border-t border-hv-border flex items-center justify-between gap-2">
                      <span className="text-[14px] font-semibold text-hv-text tabular-nums">
                        {formatINR(asset.purchasePrice, asset.currency)}
                      </span>
                      <span className={`text-[12px] font-medium flex items-center gap-1 truncate ${statusColor}`}>
                        {dueTask ? (
                          <Wrench className="w-3 h-3 shrink-0" />
                        ) : wEval.health === 'expiring_soon' || wEval.health === 'expired' ? (
                          <ShieldAlert className="w-3 h-3 shrink-0" />
                        ) : (
                          <ShieldCheck className="w-3 h-3 shrink-0" />
                        )}
                        <span className="truncate">{statusText}</span>
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="bg-hv-card border border-hv-border rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-hv-border text-[11.5px] font-semibold text-hv-muted bg-hv-subtle">
                  <th className="py-2.5 px-4">Asset</th>
                  <th className="py-2.5 px-3">Space</th>
                  <th className="py-2.5 px-3">Serial</th>
                  <th className="py-2.5 px-3">Purchased</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-4 text-right">Valuation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hv-border text-[13px]">
                {filteredAssets.map((asset) => {
                  const warranty = warrantyByAsset.get(asset.id);
                  const wEval = evaluateWarranty(warranty, warrantyAlertDays);
                  const dueTask = dueTaskByAsset.get(asset.id);
                  const isSelected = selectedAssetId === asset.id;

                  const statusText = dueTask
                    ? `${dueTask.taskName} (${evaluateMaintenanceTask(dueTask).label})`
                    : wEval.label;
                  const statusColor = dueTask
                    ? 'text-hv-warning'
                    : wEval.health === 'active'
                    ? 'text-hv-success'
                    : wEval.health === 'expiring_soon'
                    ? 'text-hv-warning'
                    : wEval.health === 'expired'
                    ? 'text-hv-danger'
                    : 'text-hv-muted';

                  return (
                    <tr
                      key={asset.id}
                      onClick={() => onSelectAsset(asset.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-hv-accent-fg/10'
                          : 'hover:bg-hv-hover/60'
                      }`}
                    >
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-hv-text">
                          {asset.name}
                        </div>
                        <div className="text-[11.5px] text-hv-muted">
                          {asset.brand} · {asset.model}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-hv-muted whitespace-nowrap">
                        {asset.locationName}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[12px] text-hv-muted whitespace-nowrap">
                        {asset.serialNumber || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-hv-muted tabular-nums whitespace-nowrap">
                        {formatDate(asset.purchaseDate)}
                      </td>
                      <td className={`py-2.5 px-3 font-medium text-[12px] ${statusColor}`}>
                        {statusText}
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-hv-text tabular-nums whitespace-nowrap">
                        {formatINR(asset.purchasePrice, asset.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

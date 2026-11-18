import { CheckCircle2, Lock, PackageCheck, Shield, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  AssetRecord,
  DocumentWithLinks,
  InsuranceExportResult,
  Location,
} from '@/src/types/homevault';
import { formatBytes, formatINR } from '@/src/utils/format';
import { homeVaultService } from '@/src/services/database/homeVaultService';

interface InsuranceExportModalProps {
  isOpen: boolean;
  assets: AssetRecord[];
  locations: Location[];
  documents: DocumentWithLinks[];
  onClose: () => void;
}

export function InsuranceExportModal({
  isOpen,
  assets,
  locations,
  documents,
  onClose,
}: InsuranceExportModalProps) {
  const [scope, setScope] = useState<'entire' | 'room'>('entire');
  const [selectedRoom, setSelectedRoom] = useState<string>(locations[0]?.name ?? 'Living Room');
  const [includeReceipts, setIncludeReceipts] = useState(true);
  const [includeSerialPhotos, setIncludeSerialPhotos] = useState(true);
  const [includeWarranties, setIncludeWarranties] = useState(true);
  const [includeManuals, setIncludeManuals] = useState(false);
  const [includeMaintenanceHistory, setIncludeMaintenanceHistory] = useState(true);
  const [includeValuationPdf, setIncludeValuationPdf] = useState(true);
  const [password, setPassword] = useState('');
  const [exporting, setExporting] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InsuranceExportResult | null>(null);

  const summary = useMemo(() => {
    const filteredAssets =
      scope === 'room' ? assets.filter((a) => a.locationName === selectedRoom) : assets;
    const totalValuation = filteredAssets.reduce((sum, a) => sum + a.purchasePrice, 0);

    // Estimate archive size dynamically from actual documents + generated PDF/CSV overhead
    const assetIds = new Set(filteredAssets.map((a) => a.id));
    let docBytes = 0;
    for (const d of documents) {
      if (scope === 'room' && !d.linkedAssetIds.some((id) => assetIds.has(id))) {
        continue;
      }
      const inc =
        d.category === 'Invoices' || d.category === 'Service Receipts'
          ? includeReceipts
          : d.category === 'Serial Photos'
          ? includeSerialPhotos
          : d.category === 'Warranty Certificates'
          ? includeWarranties
          : d.category === 'User Manuals'
          ? includeManuals
          : true;
      if (inc) docBytes += d.fileSizeBytes || 0;
    }

    const estimatedSize =
      docBytes +
      filteredAssets.length * 420 +
      (includeValuationPdf ? 28_000 : 0) +
      (includeMaintenanceHistory ? 4_000 : 0);

    return {
      assetCount: filteredAssets.length,
      totalValuation,
      estimatedSize,
    };
  }, [
    scope,
    selectedRoom,
    assets,
    documents,
    includeReceipts,
    includeSerialPhotos,
    includeWarranties,
    includeManuals,
    includeMaintenanceHistory,
    includeValuationPdf,
  ]);

  if (!isOpen) return null;

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim().length < 6) {
      setError('Enter an encryption password of at least 6 characters.');
      return;
    }
    setExporting(true);
    setError(null);
    setResult(null);
    setProgressMsg('Generating valuation PDF, CSV inventory, and encrypted ZIP archive...');

    try {
      const res = await homeVaultService.exportInsurancePackage({
        roomFilter: scope === 'room' ? selectedRoom : null,
        includeReceipts,
        includeSerialPhotos,
        includeWarranties,
        includeManuals,
        includeMaintenanceHistory,
        includeValuationPdf,
        password: password.trim(),
      });
      if (!res) {
        setProgressMsg(null);
        setExporting(false);
        return;
      }
      setResult(res);
      setProgressMsg(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Insurance export failed.');
      setProgressMsg(null);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="insurance-export-title"
    >
      <div className="w-full max-w-xl bg-hv-card border border-hv-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-hv-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-hv-accent-fg" />
            <div>
              <h2
                id="insurance-export-title"
                className="text-[16px] font-semibold text-hv-text"
              >
                Export Insurance & Moving Package
              </h2>
              <p className="text-[12px] text-hv-muted">
                Authenticated encrypted ZIP archive with valuation PDF & CSV inventory.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export modal"
            className="p-1.5 rounded-lg text-hv-muted hover:bg-hv-elevated"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleExport(e)} className="p-6 space-y-5">
          {/* Scope Selector */}
          <div className="space-y-2">
            <div className="text-[12px] font-semibold text-hv-muted">
              Coverage Scope
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope('entire')}
                className={`py-2 px-3 rounded-lg border text-[13px] font-medium transition-colors ${
                  scope === 'entire'
                    ? 'border-hv-accent bg-hv-accent/10 text-hv-accent-fg'
                    : 'border-hv-border-strong text-hv-text hover:bg-hv-subtle'
                }`}
              >
                Entire Home
              </button>
              <button
                type="button"
                onClick={() => setScope('room')}
                className={`py-2 px-3 rounded-lg border text-[13px] font-medium transition-colors ${
                  scope === 'room'
                    ? 'border-hv-accent bg-hv-accent/10 text-hv-accent-fg'
                    : 'border-hv-border-strong text-hv-text hover:bg-hv-subtle'
                }`}
              >
                Selected Room
              </button>
            </div>
            {scope === 'room' && (
              <select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                className="w-full mt-2 px-3 py-2 rounded-lg bg-hv-subtle border border-hv-border-strong text-[13px] text-hv-text"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.name}>
                    {l.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Package Contents */}
          <div className="space-y-2">
            <div className="text-[12px] font-semibold text-hv-muted">
              Included Materials
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
              <CheckRow
                checked={includeValuationPdf}
                onChange={setIncludeValuationPdf}
                label="Valuation PDF Report"
              />
              <CheckRow
                checked={includeReceipts}
                onChange={setIncludeReceipts}
                label="Full-resolution receipts"
              />
              <CheckRow
                checked={includeSerialPhotos}
                onChange={setIncludeSerialPhotos}
                label="Serial number photographs"
              />
              <CheckRow
                checked={includeWarranties}
                onChange={setIncludeWarranties}
                label="Warranty certificates"
              />
              <CheckRow
                checked={includeManuals}
                onChange={setIncludeManuals}
                label="User manuals"
              />
              <CheckRow
                checked={includeMaintenanceHistory}
                onChange={setIncludeMaintenanceHistory}
                label="Maintenance history"
              />
            </div>
          </div>

          {/* Live Package Summary */}
          <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-hv-subtle border border-hv-border">
            <div>
              <div className="text-[11px] text-hv-muted">Asset Count</div>
              <div className="text-[15px] font-semibold tabular-nums text-hv-text">
                {summary.assetCount}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-hv-muted">Total Valuation</div>
              <div className="text-[15px] font-semibold tabular-nums text-hv-text">
                {formatINR(summary.totalValuation)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-hv-muted">Est. Archive Size</div>
              <div className="text-[15px] font-semibold tabular-nums text-hv-text">
                {formatBytes(summary.estimatedSize)}
              </div>
            </div>
          </div>

          {/* Encryption Password */}
          <label className="block space-y-1.5">
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-hv-text">
              <Lock className="w-3.5 h-3.5 text-hv-accent-fg" />
              <span>Archive Encryption Password (min 6 characters)</span>
            </span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password to encrypt ZIP package"
              className="w-full px-3 py-2 rounded-lg bg-hv-subtle border border-hv-border-strong text-[13px] text-hv-text focus:outline-none focus:ring-2 focus:ring-hv-accent/40 focus:border-hv-accent"
            />
          </label>

          {progressMsg && (
            <div className="text-[12.5px] text-hv-info font-medium">{progressMsg}</div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-hv-danger/10 border border-hv-danger/20 text-[12.5px] text-hv-danger">
              {error}
            </div>
          )}

          {result && (
            <div className="p-3.5 rounded-xl bg-hv-success/10 border border-hv-success/20 text-[12.5px] text-hv-success flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">Insurance Package Verified & Created</div>
                <div className="text-hv-text mt-0.5">
                  Saved to <span className="font-mono text-[11.5px]">{result.archivePath}</span> ({formatBytes(result.fileSizeBytes)}, {result.assetCount} assets).
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[13px] font-medium text-hv-muted hover:text-hv-text hover:bg-hv-elevated transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={exporting || summary.assetCount === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-hv-accent hover:bg-hv-accent-hover disabled:opacity-50 text-white text-[13px] font-medium transition-colors"
            >
              <PackageCheck className="w-4 h-4" />
              <span>{exporting ? 'Creating Archive...' : 'Generate Encrypted Package'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 p-2 rounded-lg bg-hv-subtle border border-hv-border cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded accent-hv-accent"
      />
      <span className="text-hv-text">{label}</span>
    </label>
  );
}

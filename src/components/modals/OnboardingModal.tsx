import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FolderOpen,
  FolderTree,
  HardDrive,
  Home,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AppSettings, StorageConfig } from '@/src/types/homevault';
import { homeVaultService } from '@/src/services/database/homeVaultService';

interface OnboardingModalProps {
  isOpen: boolean;
  settings: AppSettings;
  assetCount: number;
  onClose: () => void;
  onComplete: (options: {
    ownerName: string;
    residenceName: string;
    storagePath?: string;
    loadSample: boolean;
  }) => Promise<void>;
}

export function OnboardingModal({
  isOpen,
  settings,
  assetCount,
  onClose,
  onComplete,
}: OnboardingModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [ownerName, setOwnerName] = useState(settings.ownerName);
  const [residenceName, setResidenceName] = useState(settings.residenceName);
  const [storagePath, setStoragePath] = useState(settings.storagePath);
  const [storageCfg, setStorageCfg] = useState<StorageConfig | null>(null);
  const [startMode, setStartMode] = useState<'clean' | 'sample'>('clean');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setOwnerName(settings.ownerName);
    setResidenceName(settings.residenceName);
    setError(null);
    void homeVaultService
      .getStorageConfig()
      .then((cfg) => {
        setStorageCfg(cfg);
        setStoragePath(cfg.storagePath);
      })
      .catch(() => {});
  }, [isOpen, settings.ownerName, settings.residenceName]);

  if (!isOpen) return null;

  const isNative = homeVaultService.isNativeDesktop();

  const handleBrowseFolder = async () => {
    setError(null);
    try {
      const updated = await homeVaultService.chooseAndSetStorageLocation(false);
      if (updated) {
        setStorageCfg(updated);
        setStoragePath(updated.storagePath);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to select storage folder.');
    }
  };

  const handleFinish = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onComplete({
        ownerName: ownerName.trim() || 'Homeowner',
        residenceName: residenceName.trim() || 'Main Residence',
        storagePath: storagePath.trim() || undefined,
        loadSample: startMode === 'sample' && assetCount === 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save onboarding configuration.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-label="HomeVault Getting Started Guide"
    >
      <div className="w-full max-w-2xl bg-hv-card border border-hv-border-strong rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-hv-border bg-hv-subtle flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-hv-accent flex items-center justify-center text-white shrink-0">
              <Home className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-hv-text">
                Welcome to HomeVault
              </h2>
              <p className="text-[12px] text-hv-muted">
                Step {step} of 3 · Offline household asset & document vault
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Skip guide"
            className="p-1.5 rounded-lg text-hv-muted hover:text-hv-text hover:bg-hv-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Strip */}
        <div className="px-6 pt-4 grid grid-cols-3 gap-2">
          {[
            { num: 1, label: '1. Residence & Storage' },
            { num: 2, label: '2. How It Works' },
            { num: 3, label: '3. Start Mode' },
          ].map((item) => (
            <button
              key={item.num}
              type="button"
              onClick={() => setStep(item.num as 1 | 2 | 3)}
              className={`text-left px-3 py-2 rounded-lg text-[12px] font-medium border transition-colors ${
                step === item.num
                  ? 'border-hv-accent-fg bg-hv-accent-fg/10 text-hv-accent-fg'
                  : step > item.num
                  ? 'border-hv-border bg-hv-subtle text-hv-success'
                  : 'border-hv-border text-hv-muted'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[65vh]">
          {error && (
            <div className="p-3 rounded-xl bg-hv-danger/10 border border-hv-danger/25 text-[12.5px] text-hv-danger">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <span className="text-[12px] font-medium text-hv-muted">
                    Your Name
                  </span>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g. Arnab Saha"
                    className="w-full px-3 py-2 rounded-lg bg-hv-subtle border border-hv-border-strong text-[13px] text-hv-text"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[12px] font-medium text-hv-muted">
                    Primary Residence Name
                  </span>
                  <input
                    type="text"
                    value={residenceName}
                    onChange={(e) => setResidenceName(e.target.value)}
                    placeholder="e.g. Main Residence"
                    className="w-full px-3 py-2 rounded-lg bg-hv-subtle border border-hv-border-strong text-[13px] text-hv-text"
                  />
                </label>
              </div>

              <div className="p-4 rounded-xl bg-hv-subtle border border-hv-border space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <HardDrive className="w-4 h-4 text-hv-accent-fg mt-0.5 shrink-0" />
                    <div>
                      <div className="text-[13.5px] font-semibold text-hv-text">
                        Authorized Document Storage Folder
                      </div>
                      <p className="text-[12px] text-hv-muted mt-0.5">
                        Choose a safe drive or folder (such as D:\HomeVault) for warranty PDFs, payment slips, and DOCX files instead of keeping everything on C:.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={storagePath}
                    onChange={(e) => setStoragePath(e.target.value)}
                    placeholder={storageCfg?.defaultStoragePath || 'D:\\HomeVault\\VaultFiles'}
                    className="flex-1 px-3 py-2 rounded-lg bg-hv-card border border-hv-border-strong font-mono text-[12px] text-hv-text"
                  />
                  {isNative && (
                    <button
                      type="button"
                      onClick={() => void handleBrowseFolder()}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-hv-card border border-hv-border-strong text-[12.5px] font-medium text-hv-text hover:bg-hv-hover shrink-0"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-hv-accent-fg" />
                      <span>Browse Folder</span>
                    </button>
                  )}
                </div>

                <div className="text-[11.5px] text-hv-muted font-mono bg-hv-card border border-hv-border rounded-lg p-2.5 leading-relaxed">
                  <div>{storagePath || 'D:\\HomeVault\\VaultFiles'}/</div>
                  <div className="pl-3">├─ Documents/Invoices/2026/a1b2c3d4_payment_slip.pdf</div>
                  <div className="pl-3">├─ Documents/Warranty Certificates/2026/...</div>
                  <div className="pl-3">└─ Backups/</div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-4 rounded-xl bg-hv-subtle border border-hv-border space-y-1.5">
                <Home className="w-4 h-4 text-hv-accent-fg" />
                <div className="text-[13.5px] font-semibold text-hv-text">
                  Assets & Rooms
                </div>
                <p className="text-[12px] text-hv-muted leading-relaxed">
                  Catalog appliances, electronics, furniture, and vehicles by room with serial numbers, invoices, and warranty expiry countdowns.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-hv-subtle border border-hv-border space-y-1.5">
                <FolderTree className="w-4 h-4 text-hv-accent-fg" />
                <div className="text-[13.5px] font-semibold text-hv-text">
                  Structured Document Vault
                </div>
                <p className="text-[12px] text-hv-muted leading-relaxed">
                  Upload PDFs, DOCX, XLSX, or photos. Files are organized into Category &amp; Year subfolders inside your chosen storage drive.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-hv-subtle border border-hv-border space-y-1.5">
                <ShieldCheck className="w-4 h-4 text-hv-success" />
                <div className="text-[13.5px] font-semibold text-hv-text">
                  Tamper &amp; Integrity Tracking
                </div>
                <p className="text-[12px] text-hv-muted leading-relaxed">
                  Every stored file records a SHA-256 fingerprint and modified timestamp so HomeVault alerts you if a file is altered outside the app.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-hv-subtle border border-hv-border space-y-1.5">
                <Wrench className="w-4 h-4 text-hv-warning" />
                <div className="text-[13.5px] font-semibold text-hv-text">
                  Maintenance &amp; Backups
                </div>
                <p className="text-[12px] text-hv-muted leading-relaxed">
                  Schedule recurring filter cleanings, record paint/breaker specs, and export encrypted insurance packs or .hvbackup snapshots.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="text-[13.5px] font-semibold text-hv-text">
                How would you like to start?
              </div>

              <button
                type="button"
                onClick={() => setStartMode('clean')}
                className={`w-full text-left p-4 rounded-xl border transition-colors flex items-start gap-3 ${
                  startMode === 'clean'
                    ? 'border-hv-accent-fg bg-hv-accent-fg/[0.06] ring-1 ring-hv-accent-fg/30'
                    : 'border-hv-border hover:bg-hv-hover/60'
                }`}
              >
                <CheckCircle2
                  className={`w-5 h-5 mt-0.5 shrink-0 ${
                    startMode === 'clean' ? 'text-hv-accent-fg' : 'text-hv-muted'
                  }`}
                />
                <div>
                  <div className="text-[14px] font-semibold text-hv-text">
                    Start with a Clean Vault (Recommended)
                  </div>
                  <p className="text-[12.5px] text-hv-muted mt-0.5">
                    Begin with zero pre-filled items and add only your real appliances, warranties, receipts, and home records.
                  </p>
                </div>
              </button>

              {assetCount === 0 && (
                <button
                  type="button"
                  onClick={() => setStartMode('sample')}
                  className={`w-full text-left p-4 rounded-xl border transition-colors flex items-start gap-3 ${
                    startMode === 'sample'
                      ? 'border-hv-accent-fg bg-hv-accent-fg/[0.06] ring-1 ring-hv-accent-fg/30'
                      : 'border-hv-border hover:bg-hv-hover/60'
                  }`}
                >
                  <Sparkles
                    className={`w-5 h-5 mt-0.5 shrink-0 ${
                      startMode === 'sample' ? 'text-hv-accent-fg' : 'text-hv-muted'
                    }`}
                  />
                  <div>
                    <div className="text-[14px] font-semibold text-hv-text">
                      Explore with Sample Household Data
                    </div>
                    <p className="text-[12.5px] text-hv-muted mt-0.5">
                      Load 24 sample appliances, warranty schedules, maintenance history, and a sample manual to test workflows first.
                    </p>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-hv-border bg-hv-subtle flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="text-[12.5px] font-medium text-hv-muted hover:text-hv-text"
          >
            Skip for now
          </button>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-hv-border-strong bg-hv-card text-[13px] font-medium text-hv-text hover:bg-hv-hover"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-hv-accent hover:bg-hv-accent-hover text-white text-[13px] font-medium"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleFinish()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-hv-accent hover:bg-hv-accent-hover disabled:opacity-60 text-white text-[13px] font-medium"
              >
                <span>{submitting ? 'Setting up...' : 'Finish Setup'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

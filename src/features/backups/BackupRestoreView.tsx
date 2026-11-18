import {
  Archive,
  CheckCircle2,
  Download,
  RotateCcw,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { BackupHistoryRecord, BackupManifest } from '@/src/types/homevault';
import { formatBytes, formatDate } from '@/src/utils/format';
import { homeVaultService } from '@/src/services/database/homeVaultService';

interface BackupRestoreViewProps {
  backups: BackupHistoryRecord[];
  assetCount: number;
  documentCount: number;
  onRefresh: () => Promise<void>;
  embedded?: boolean;
}

export function BackupRestoreView({
  backups,
  assetCount,
  documentCount,
  onRefresh,
  embedded = false,
}: BackupRestoreViewProps) {
  const [creating, setCreating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingNativePath, setPendingNativePath] = useState<string | null>(null);
  const [previewManifest, setPreviewManifest] = useState<BackupManifest | null>(null);
  const [restoring, setRestoring] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateBackup = async () => {
    setCreating(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const record = await homeVaultService.createBackup();
      if (record) {
        setStatusMsg(
          `Created verified archive ${record.archiveName} (${formatBytes(record.sizeBytes)}, SHA-256: ${record.sha256Checksum.slice(0, 12)}…).`
        );
        await onRefresh();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Backup creation failed.');
    } finally {
      setCreating(false);
    }
  };

  const handlePickRestoreFile = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    if (homeVaultService.isNativeDesktop()) {
      try {
        const res = await homeVaultService.validateBackupNative();
        if (res) {
          setPendingNativePath(res.path);
          setPreviewManifest(res.manifest);
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Backup validation failed.');
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleBrowserFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const manifest = await homeVaultService.validateBackupFileBrowser(file);
      setPendingFile(file);
      setPreviewManifest(manifest);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Backup validation failed.');
      setPendingFile(null);
      setPreviewManifest(null);
    } finally {
      e.target.value = '';
    }
  };

  const handleConfirmRestore = async () => {
    if (!previewManifest) return;
    setRestoring(true);
    setErrorMsg(null);
    try {
      if (homeVaultService.isNativeDesktop() && pendingNativePath) {
        await homeVaultService.restoreBackupNative(pendingNativePath);
      } else if (pendingFile) {
        await homeVaultService.restoreFromBackupBrowser(pendingFile);
      }
      setStatusMsg(
        `Vault restored to snapshot from ${formatDate(previewManifest.createdAt)} (${previewManifest.assetCount} assets, ${previewManifest.documentCount} documents). A pre-restore safety snapshot was saved.`
      );
      setPendingFile(null);
      setPendingNativePath(null);
      setPreviewManifest(null);
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Restore failed; original database preserved.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className={embedded ? 'space-y-6' : 'h-full overflow-y-auto p-6 space-y-6'}>
      <div>
        {embedded ? (
          <h2 className="text-[20px] font-semibold tracking-tight text-hv-text">
            Backup & Restore
          </h2>
        ) : (
          <h1 className="text-[22px] font-semibold tracking-tight text-hv-text">
            Backup & Restore
          </h1>
        )}
        <p className="text-[13px] text-hv-muted mt-0.5">
          Create SHA-256 verified full snapshots of your SQLite vault, attachments, and configuration.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Create Backup Card */}
        <div className="bg-hv-card border border-hv-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <Archive className="w-5 h-5 text-hv-accent-fg" />
            <div>
              <h2 className="text-[15px] font-semibold text-hv-text">
                Full Vault Snapshot
              </h2>
              <p className="text-[12px] text-hv-muted">
                Includes database ({assetCount} assets), {documentCount} vault attachments, and settings.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={creating}
            onClick={() => void handleCreateBackup()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-hv-accent hover:bg-hv-accent-hover disabled:opacity-60 text-white text-[13px] font-medium"
          >
            <Download className="w-4 h-4" />
            <span>{creating ? 'Creating Snapshot...' : 'Create Timestamped Backup'}</span>
          </button>
        </div>

        {/* Restore Card */}
        <div className="bg-hv-card border border-hv-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <RotateCcw className="w-5 h-5 text-hv-warning" />
            <div>
              <h2 className="text-[15px] font-semibold text-hv-text">
                Validate & Restore Archive
              </h2>
              <p className="text-[12px] text-hv-muted">
                Verifies SHA-256 checksums and takes a pre-restore safety backup before applying.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handlePickRestoreFile()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-hv-elevated hover:bg-hv-hover border border-hv-border-strong text-hv-text text-[13px] font-medium"
          >
            <Upload className="w-4 h-4" />
            <span>Select .hvbackup File to Inspect</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".hvbackup,.zip"
            onChange={(e) => void handleBrowserFileSelected(e)}
            className="hidden"
          />
        </div>
      </div>

      {/* Restore Confirmation Preview */}
      {previewManifest && (
        <div className="p-5 rounded-xl bg-hv-card border border-hv-accent-fg/40 space-y-3">
          <div className="flex items-center gap-2 text-hv-success text-[13.5px] font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>Backup Integrity Verified — Ready for Restore Preview</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12.5px]">
            <div>
              <div className="text-hv-muted">Created</div>
              <div className="font-medium text-hv-text">
                {formatDate(previewManifest.createdAt)}
              </div>
            </div>
            <div>
              <div className="text-hv-muted">Assets</div>
              <div className="font-medium tabular-nums text-hv-text">
                {previewManifest.assetCount}
              </div>
            </div>
            <div>
              <div className="text-hv-muted">Documents</div>
              <div className="font-medium tabular-nums text-hv-text">
                {previewManifest.documentCount}
              </div>
            </div>
            <div>
              <div className="text-hv-muted">App Version</div>
              <div className="font-mono text-hv-text">
                {previewManifest.appVersion}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              disabled={restoring}
              onClick={() => void handleConfirmRestore()}
              className="px-4 py-2 rounded-lg bg-hv-warning-btn hover:opacity-90 text-white text-[13px] font-medium"
            >
              {restoring ? 'Restoring Vault...' : 'Confirm & Restore Snapshot'}
            </button>
            <button
              type="button"
              onClick={() => {
                setPreviewManifest(null);
                setPendingFile(null);
                setPendingNativePath(null);
              }}
              className="px-3 py-2 text-[13px] text-hv-muted hover:text-hv-text"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {statusMsg && (
        <div className="p-3.5 rounded-xl bg-hv-success/10 border border-hv-success/25 text-[13px] text-hv-success flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-hv-danger/10 border border-hv-danger/25 text-[13px] text-hv-danger">
          {errorMsg}
        </div>
      )}

      {/* Backup History */}
      <div className="bg-hv-card border border-hv-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-hv-border text-[13.5px] font-semibold text-hv-text">
          Backup History
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-hv-border bg-hv-subtle text-[11.5px] font-semibold text-hv-muted">
              <th className="py-2.5 px-4">Archive</th>
              <th className="py-2.5 px-3">Date</th>
              <th className="py-2.5 px-3">Contents</th>
              <th className="py-2.5 px-3">Size</th>
              <th className="py-2.5 px-4">SHA-256 Checksum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hv-border text-[12.5px]">
            {backups.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-hv-muted">
                  No backups recorded yet. Create your first local snapshot above.
                </td>
              </tr>
            ) : (
              backups.map((b) => (
                <tr key={b.id}>
                  <td className="py-2.5 px-4 font-medium text-hv-text">
                    {b.archiveName}
                  </td>
                  <td className="py-2.5 px-3 tabular-nums text-hv-muted">
                    {formatDate(b.createdAt)}
                  </td>
                  <td className="py-2.5 px-3 tabular-nums text-hv-text">
                    {b.assetCount} assets · {b.documentCount} docs
                  </td>
                  <td className="py-2.5 px-3 tabular-nums text-hv-muted">
                    {formatBytes(b.sizeBytes)}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[11.5px] text-hv-muted">
                    {b.sha256Checksum.slice(0, 20)}…
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

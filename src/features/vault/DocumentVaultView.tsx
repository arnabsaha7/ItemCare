import {
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Eye,
  FileText,
  FolderTree,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type {
  AssetRecord,
  DocumentCategory,
  DocumentWithLinks,
  IntegrityReport,
} from '@/src/types/homevault';
import { formatBytes, formatDate } from '@/src/utils/format';
import { homeVaultService } from '@/src/services/database/homeVaultService';

const DOC_CATEGORIES: DocumentCategory[] = [
  'Invoices',
  'Warranty Certificates',
  'User Manuals',
  'Serial Photos',
  'Service Receipts',
  'Insurance Documents',
  'Property Documents',
  'Other',
];

interface DocumentVaultViewProps {
  documents: DocumentWithLinks[];
  assets: AssetRecord[];
  onOpenDocument: (doc: DocumentWithLinks, page?: number) => void;
  onRefresh: () => Promise<void>;
}

export function DocumentVaultView({
  documents,
  assets,
  onOpenDocument,
  onRefresh,
}: DocumentVaultViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<'All' | DocumentCategory>('All');
  const [search, setSearch] = useState('');
  const [importCategory, setImportCategory] = useState<DocumentCategory>('User Manuals');
  const [importAssetId, setImportAssetId] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [editingDoc, setEditingDoc] = useState<DocumentWithLinks | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<DocumentCategory>('Other');
  const [editAssetId, setEditAssetId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [integrityReport, setIntegrityReport] = useState<IntegrityReport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const integritySummary = useMemo(() => {
    let modified = 0;
    let missing = 0;
    for (const d of documents) {
      if (d.integrityStatus === 'modified') modified += 1;
      if (d.isMissing || d.integrityStatus === 'missing') missing += 1;
    }
    return { modified, missing };
  }, [documents]);

  const assetNameMap = useMemo(() => {
    const m = new Map<string, string>();
    assets.forEach((a) => m.set(a.id, a.name));
    return m;
  }, [assets]);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (selectedCategory !== 'All' && d.category !== selectedCategory) return false;
      if (q) {
        const match =
          d.title.toLowerCase().includes(q) ||
          d.fileName.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [documents, selectedCategory, search]);

  const handleBrowserFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setImporting(true);
    setImportError(null);
    try {
      for (const file of Array.from(files)) {
        await homeVaultService.importDocumentFromBrowserFile(
          file,
          file.name.replace(/\.[^.]+$/, ''),
          importCategory,
          importAssetId ? [importAssetId] : []
        );
      }
      await onRefresh();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Document import failed.');
    } finally {
      setImporting(false);
    }
  };

  const handleImportClick = async () => {
    if (homeVaultService.isNativeDesktop()) {
      setImporting(true);
      setImportError(null);
      try {
        await homeVaultService.importDocumentNative(
          importCategory,
          importAssetId ? [importAssetId] : []
        );
        await onRefresh();
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Native import failed.');
      } finally {
        setImporting(false);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc) return;
    await homeVaultService.updateDocumentMetadata(
      editingDoc.id,
      editTitle,
      editCategory,
      editAssetId ? [editAssetId] : []
    );
    setEditingDoc(null);
    await onRefresh();
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-hv-text">
            Documents & Vault
          </h1>
          <p className="text-[13px] text-hv-muted mt-0.5">
            Store invoices, warranty certificates, user manuals, and property records locally with offline PDF indexing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={verifying || documents.length === 0}
            onClick={() => {
              setVerifying(true);
              setImportError(null);
              void homeVaultService
                .verifyDocumentsIntegrity()
                .then(async (report) => {
                  setIntegrityReport(report);
                  await onRefresh();
                })
                .catch((err) =>
                  setImportError(
                    err instanceof Error ? err.message : 'Integrity verification failed.'
                  )
                )
                .finally(() => setVerifying(false));
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-hv-card border border-hv-border-strong text-[12.5px] font-medium text-hv-text hover:bg-hv-elevated disabled:opacity-50 whitespace-nowrap"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-hv-success" />
            <span>{verifying ? 'Verifying...' : 'Verify Integrity'}</span>
          </button>
          <select
            aria-label="Import category"
            value={importCategory}
            onChange={(e) => setImportCategory(e.target.value as DocumentCategory)}
            className="px-2.5 py-2 rounded-lg bg-hv-card border border-hv-border-strong text-[12.5px] text-hv-text"
          >
            {DOC_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            aria-label="Link asset on import"
            value={importAssetId}
            onChange={(e) => setImportAssetId(e.target.value)}
            className="px-2.5 py-2 rounded-lg bg-hv-card border border-hv-border-strong text-[12.5px] text-hv-text max-w-[180px]"
          >
            <option value="">No linked asset</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={importing}
            onClick={() => void handleImportClick()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-hv-accent hover:bg-hv-accent-hover text-white text-[13px] font-medium whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{importing ? 'Indexing...' : 'Import File'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.txt"
            onChange={(e) => void handleBrowserFiles(e.target.files)}
            className="hidden"
          />
        </div>
      </div>

      {(integritySummary.modified > 0 || integritySummary.missing > 0) && (
        <div className="p-3.5 rounded-xl bg-hv-warning/10 border border-hv-warning/25 flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-hv-warning">
          <div className="flex items-center gap-2 font-medium">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>
              File integrity notice:{' '}
              {integritySummary.modified > 0 &&
                `${integritySummary.modified} document(s) modified outside HomeVault`}
              {integritySummary.modified > 0 && integritySummary.missing > 0 && ' · '}
              {integritySummary.missing > 0 && `${integritySummary.missing} missing from storage`}
            </span>
          </div>
          <span className="text-[11.5px] opacity-85">
            Inspect changed files or click Accept Current if edits were intentional.
          </span>
        </div>
      )}

      {integrityReport && integritySummary.modified === 0 && integritySummary.missing === 0 && (
        <div className="p-3 rounded-xl bg-hv-success/10 border border-hv-success/20 flex items-center gap-2 text-[12.5px] text-hv-success">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            Verified {integrityReport.totalChecked} managed file(s) via SHA-256 — all intact.
          </span>
        </div>
      )}

      {/* Drag and drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          void handleBrowserFiles(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed px-6 py-4 text-center transition-colors ${
          dragActive
            ? 'border-hv-accent bg-hv-accent/10'
            : 'border-hv-border-strong bg-hv-card/60'
        }`}
      >
        <div className="text-[13px] font-medium text-hv-text">
          Drop PDF manuals, invoices, or photos here to import & index into HomeVault
        </div>
        <div className="text-[11.5px] text-hv-muted mt-0.5">
          Supported formats: PDF, JPG, JPEG, PNG, DOCX, XLSX, TXT
        </div>
      </div>

      {importError && (
        <div className="p-3 rounded-lg bg-hv-danger/10 border border-hv-danger/20 text-[12.5px] text-hv-danger">
          {importError}
        </div>
      )}

      {/* Search & Category Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-hv-sidebar">
          {(['All', ...DOC_CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-md text-[11.5px] font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-hv-card text-hv-text shadow-2xs'
                  : 'text-hv-muted hover:text-hv-text'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <label className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-hv-muted absolute left-3" />
          <input
            type="text"
            placeholder="Filter documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 rounded-lg bg-hv-card border border-hv-border-strong text-[12.5px] text-hv-text focus:outline-none focus:ring-2 focus:ring-hv-accent/40 focus:border-hv-accent"
          />
        </label>
      </div>

      {/* Edit Metadata Inline Bar */}
      {editingDoc && (
        <form
          onSubmit={(e) => void saveEdit(e)}
          className="p-4 rounded-xl bg-hv-card border border-hv-accent/40 flex flex-wrap items-end gap-3"
        >
          <label className="flex-1 min-w-[180px] text-[11.5px] text-hv-muted">
            Document Title
            <input
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="mt-1 w-full px-2.5 py-1.5 rounded-md bg-hv-subtle border border-hv-border-strong text-[13px] text-hv-text"
            />
          </label>
          <label className="text-[11.5px] text-hv-muted">
            Category
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value as DocumentCategory)}
              className="mt-1 block px-2.5 py-1.5 rounded-md bg-hv-subtle border border-hv-border-strong text-[13px] text-hv-text"
            >
              {DOC_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11.5px] text-hv-muted">
            Linked Asset
            <select
              value={editAssetId}
              onChange={(e) => setEditAssetId(e.target.value)}
              className="mt-1 block px-2.5 py-1.5 rounded-md bg-hv-subtle border border-hv-border-strong text-[13px] text-hv-text"
            >
              <option value="">Unlinked</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-lg bg-hv-accent hover:bg-hv-accent-hover text-white text-[12.5px] font-medium"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditingDoc(null)}
            className="px-3 py-1.5 text-[12.5px] text-hv-muted hover:text-hv-text"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Documents Table */}
      <div className="bg-hv-card border border-hv-border rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-hv-border bg-hv-subtle text-[11.5px] font-semibold text-hv-muted">
              <th className="py-2.5 px-4">Document &amp; Storage Path</th>
              <th className="py-2.5 px-3">Category</th>
              <th className="py-2.5 px-3">Integrity</th>
              <th className="py-2.5 px-3">Linked Asset</th>
              <th className="py-2.5 px-3">Size</th>
              <th className="py-2.5 px-3">Added</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hv-border text-[13px]">
            {filteredDocs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-hv-muted">
                  No documents found in this category.
                </td>
              </tr>
            ) : (
              filteredDocs.map((doc) => {
                const linkedName = doc.linkedAssetIds
                  .map((id) => assetNameMap.get(id))
                  .filter(Boolean)
                  .join(', ');
                const isModified = doc.integrityStatus === 'modified';
                const isMissing = doc.isMissing || doc.integrityStatus === 'missing';
                const isBuiltin = doc.integrityStatus === 'builtin' || doc.filePath.startsWith('builtin:');
                return (
                  <tr
                    key={doc.id}
                    className="hover:bg-hv-subtle transition-colors"
                  >
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-4 h-4 text-hv-accent-fg shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium text-hv-text flex items-center gap-2">
                            <span className="truncate">{doc.title}</span>
                          </div>
                          <div className="text-[11.5px] text-hv-muted">
                            {doc.fileName} · {doc.extension.toUpperCase()}
                            {doc.pageCount > 1 ? ` · ${doc.pageCount} pages` : ''}
                          </div>
                          {doc.relativePath && (
                            <div
                              title={doc.filePath}
                              className="text-[11px] font-mono text-hv-muted flex items-center gap-1 mt-0.5 truncate max-w-[360px]"
                            >
                              <FolderTree className="w-3 h-3 shrink-0" />
                              <span className="truncate">{doc.relativePath}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-hv-muted whitespace-nowrap">
                      {doc.category}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {isMissing ? (
                        <span className="inline-flex items-center gap-1 text-[11.5px] text-hv-danger font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" /> Missing
                        </span>
                      ) : isModified ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-[11.5px] text-hv-warning font-medium">
                            <ShieldAlert className="w-3.5 h-3.5" /> Modified
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              void homeVaultService
                                .acceptModifiedDocument(doc.id)
                                .then(onRefresh)
                            }
                            className="text-[11px] font-medium text-hv-accent-fg hover:underline"
                          >
                            Accept
                          </button>
                        </div>
                      ) : isBuiltin ? (
                        <span className="text-[11.5px] text-hv-muted">
                          Sample
                        </span>
                      ) : (
                        <span
                          title={doc.sha256Hash ? `SHA-256: ${doc.sha256Hash}` : undefined}
                          className="inline-flex items-center gap-1 text-[11.5px] text-hv-success font-medium"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" /> Verified
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-hv-text">
                      {linkedName || '—'}
                    </td>
                    <td className="py-2.5 px-3 tabular-nums text-hv-muted whitespace-nowrap">
                      {formatBytes(doc.fileSizeBytes)}
                    </td>
                    <td className="py-2.5 px-3 tabular-nums text-hv-muted whitespace-nowrap">
                      {formatDate(doc.createdAt)}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            onOpenDocument(doc, doc.fileName.includes('Bosch') ? 34 : 1)
                          }
                          title="Preview document"
                          className="p-1.5 rounded-md text-hv-accent-fg hover:bg-hv-accent/10"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDoc(doc);
                            setEditTitle(doc.title);
                            setEditCategory(doc.category);
                            setEditAssetId(doc.linkedAssetIds[0] ?? '');
                          }}
                          title="Rename or categorize"
                          className="p-1.5 rounded-md text-hv-muted hover:text-hv-text"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void homeVaultService.deleteDocument(doc.id).then(onRefresh)}
                          title="Remove from vault"
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
    </div>
  );
}

import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  ShieldAlert,
  ShieldCheck,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { DocumentWithLinks } from '@/src/types/homevault';
import { homeVaultService } from '@/src/services/database/homeVaultService';
import { renderPdfPageToCanvas } from '@/src/utils/pdfEngine';
import { formatBytes } from '@/src/utils/format';

interface DocumentViewerModalProps {
  document: DocumentWithLinks | null;
  initialPage?: number;
  onClose: () => void;
  onRefresh?: () => Promise<void>;
}

export function DocumentViewerModal({
  document: doc,
  initialPage = 1,
  onClose,
  onRefresh,
}: DocumentViewerModalProps) {
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [numPages, setNumPages] = useState(doc?.pageCount ?? 1);
  const [scale, setScale] = useState(1.25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobData, setBlobData] = useState<ArrayBuffer | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setPageNumber(initialPage || 1);
  }, [doc?.id, initialPage]);

  useEffect(() => {
    if (!doc) return;
    let active = true;
    let createdUrl: string | null = null;

    const load = async () => {
      setLoading(true);
      setError(null);
      setBlobData(null);
      setImageUrl(null);
      setTextPreview(null);
      try {
        const bytes = await homeVaultService.getDocumentBytes(doc);
        if (!active) return;
        if (!bytes) {
          setError('File binary could not be located in the local vault.');
          setLoading(false);
          return;
        }
        if (doc.extension === 'pdf') {
          setBlobData(bytes);
        } else if (['jpg', 'jpeg', 'png'].includes(doc.extension)) {
          createdUrl = URL.createObjectURL(new Blob([bytes], { type: doc.mimeType }));
          setImageUrl(createdUrl);
        } else if (doc.extension === 'txt') {
          setTextPreview(new TextDecoder().decode(bytes));
        } else {
          setTextPreview(
            `Preview unavailable for .${doc.extension.toUpperCase()} spreadsheets/documents inside the lightweight viewer. Use Download to open in your default Windows application.`
          );
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to open document.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [doc]);

  useEffect(() => {
    if (!blobData || !canvasRef.current || doc?.extension !== 'pdf') return;
    let cancelled = false;
    const render = async () => {
      try {
        const total = await renderPdfPageToCanvas(blobData, pageNumber, canvasRef.current!, scale);
        if (!cancelled) setNumPages(total);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'PDF rendering failed.');
        }
      }
    };
    void render();
    return () => {
      cancelled = true;
    };
  }, [blobData, pageNumber, scale, doc?.extension]);

  if (!doc) return null;

  const handleDownload = async () => {
    const bytes = blobData ?? (await homeVaultService.getDocumentBytes(doc));
    if (!bytes) return;
    const blob = new Blob([bytes], { type: doc.mimeType });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = doc.fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Viewing ${doc.title}`}
    >
      <div className="w-full max-w-4xl h-[88vh] flex flex-col bg-hv-card border border-hv-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-hv-border flex items-center justify-between gap-3 bg-hv-subtle">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="w-4 h-4 text-hv-accent-fg shrink-0" />
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-hv-text truncate">
                {doc.fileName}
              </div>
              <div className="text-[11.5px] text-hv-muted truncate">
                {doc.category} · {formatBytes(doc.fileSizeBytes)}
                {doc.relativePath ? ` · ${doc.relativePath}` : ''}
              </div>
            </div>
          </div>

          {doc.extension === 'pdf' && (
            <div className="flex items-center gap-1.5 text-hv-text">
              <button
                type="button"
                disabled={pageNumber <= 1}
                onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-md border border-hv-border-strong disabled:opacity-40 hover:bg-hv-elevated"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 text-[12px] font-medium tabular-nums text-hv-text">
                Page {pageNumber} / {numPages}
              </span>
              <button
                type="button"
                disabled={pageNumber >= numPages}
                onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                className="p-1.5 rounded-md border border-hv-border-strong disabled:opacity-40 hover:bg-hv-elevated"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-hv-border-strong mx-1" />
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.75, +(s - 0.15).toFixed(2)))}
                className="p-1.5 rounded-md border border-hv-border-strong hover:bg-hv-elevated"
                aria-label="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(2.2, +(s + 0.15).toFixed(2)))}
                className="p-1.5 rounded-md border border-hv-border-strong hover:bg-hv-elevated"
                aria-label="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void handleDownload()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-hv-elevated border border-hv-border-strong text-[12px] font-medium text-hv-text hover:bg-hv-hover"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save Copy</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close document viewer"
              className="p-1.5 rounded-lg text-hv-muted hover:bg-hv-hover"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {doc.integrityStatus === 'modified' && (
          <div className="px-4 py-2.5 bg-hv-warning/10 border-b border-hv-warning/25 flex flex-wrap items-center justify-between gap-2 text-[12px] text-hv-warning">
            <div className="flex items-center gap-2 font-medium">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                This file was modified externally after upload (SHA-256 fingerprint mismatch).
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                void homeVaultService.acceptModifiedDocument(doc.id).then(async () => {
                  if (onRefresh) await onRefresh();
                  onClose();
                })
              }
              className="px-2.5 py-1 rounded-md bg-hv-warning-btn hover:opacity-90 text-white text-[11.5px] font-medium"
            >
              Accept Current Version
            </button>
          </div>
        )}

        {doc.integrityStatus === 'verified' && doc.sha256Hash && (
          <div className="px-4 py-1.5 bg-hv-success/10 border-b border-hv-border flex items-center justify-between text-[11px] text-hv-success">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Integrity verified</span>
            </span>
            <span className="font-mono text-hv-muted">
              SHA-256: {doc.sha256Hash.slice(0, 16)}…
            </span>
          </div>
        )}

        {/* Viewer Surface */}
        <div className="flex-1 overflow-auto bg-hv-bg p-6 flex items-start justify-center">
          {loading ? (
            <div className="text-[13px] text-hv-muted">Rendering document...</div>
          ) : error ? (
            <div className="p-6 rounded-xl bg-hv-card border border-hv-danger/25 text-[13px] text-hv-danger">
              {error}
            </div>
          ) : doc.extension === 'pdf' ? (
            <canvas
              ref={canvasRef}
              className="shadow-md rounded-md bg-white max-w-full"
            />
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt={doc.title}
              className="max-w-full max-h-full rounded-lg shadow-md object-contain"
            />
          ) : (
            <pre className="w-full max-w-3xl p-5 rounded-xl bg-hv-card border border-hv-border text-[12.5px] font-mono text-hv-text whitespace-pre-wrap">
              {textPreview}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

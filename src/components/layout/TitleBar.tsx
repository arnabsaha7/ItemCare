import {
  ArrowRight,
  BookOpen,
  Box,
  Copy,
  FileText,
  Minus,
  Moon,
  PanelLeft,
  PanelRight,
  Search,
  Square,
  Sun,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { HomeVaultIcon } from '@/src/components/shared/HomeVaultIcon';
import { homeVaultService } from '@/src/services/database/homeVaultService';
import {
  isTauriRuntime,
  windowClose,
  windowIsMaximized,
  windowMinimize,
  windowToggleMaximize,
} from '@/src/services/tauri/bridge';
import type { AppTheme, SearchHit } from '@/src/types/homevault';
import { isDarkTheme } from '@/src/types/homevault';
import './TitleBar.css';

interface TitleBarProps {
  theme: AppTheme;
  onToggleTheme: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  showInspectorToggle: boolean;
  searchFocusSignal: number;
  onSelectAsset: (assetId: string) => void;
  onOpenDocument: (documentId: string, pageNumber?: number) => void;
}

export function TitleBar({
  theme,
  onToggleTheme,
  sidebarOpen,
  onToggleSidebar,
  inspectorOpen,
  onToggleInspector,
  showInspectorToggle,
  searchFocusSignal,
  onSelectAsset,
  onOpenDocument,
}: TitleBarProps) {
  const isTauri = isTauriRuntime();
  const [maximized, setMaximized] = useState(false);

  // Inline search state
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isTauri) {
      windowIsMaximized().then(setMaximized).catch(() => {});
    }
  }, [isTauri]);

  useEffect(() => {
    if (searchFocusSignal > 0) {
      inputRef.current?.focus();
      inputRef.current?.select();
      setIsFocused(true);
    }
  }, [searchFocusSignal]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!query.trim()) {
        setHits([]);
        setActiveIndex(0);
        return;
      }
      const res = await homeVaultService.globalSearch(query);
      if (!cancelled) {
        setHits(res);
        setActiveIndex(0);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [query]);

  const handleMaximize = async () => {
    const next = await windowToggleMaximize();
    setMaximized(next);
  };

  const closeDropdown = () => {
    setIsFocused(false);
    inputRef.current?.blur();
  };

  const activateHit = (hit: SearchHit) => {
    if (hit.kind === 'manual_page' && hit.documentId) {
      onOpenDocument(hit.documentId, hit.pageNumber ?? 1);
      closeDropdown();
      return;
    }
    if (hit.kind === 'document' && hit.documentId) {
      onOpenDocument(hit.documentId, hit.pageNumber ?? 1);
      closeDropdown();
      return;
    }
    if (hit.assetId) {
      onSelectAsset(hit.assetId);
      closeDropdown();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (query) {
        setQuery('');
      } else {
        closeDropdown();
      }
    } else if (e.key === 'ArrowDown' && hits.length > 0) {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % hits.length);
    } else if (e.key === 'ArrowUp' && hits.length > 0) {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + hits.length) % hits.length);
    } else if (e.key === 'Enter' && hits[activeIndex]) {
      e.preventDefault();
      activateHit(hits[activeIndex]);
    }
  };

  return (
    <header data-tauri-drag-region className="hv-titlebar">
      {/* Left: App Icon & Title */}
      <div className="hv-titlebar-brand" data-tauri-drag-region>
        <HomeVaultIcon className="w-5 h-5 shrink-0" />
        <span className="hv-titlebar-title">HomeVault</span>
      </div>

      {/* Center: Inline Search Input & Anchored Results Dropdown */}
      <div ref={wrapRef} className="hv-titlebar-search-wrap">
        <div className={`hv-titlebar-search-box ${isFocused ? 'is-focused' : ''}`}>
          <Search className="w-4 h-4 shrink-0 text-hv-accent-fg" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onFocus={() => setIsFocused(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsFocused(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search assets, serials, manuals..."
            aria-label="Search assets, serials, and manuals"
            className="hv-titlebar-search-input"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="hv-titlebar-search-clear"
            >
              <X className="w-3 h-3" />
            </button>
          ) : (
            <kbd className="hv-titlebar-search-kbd">Ctrl+K</kbd>
          )}
        </div>

        {isFocused && (
          <div className="hv-titlebar-search-dropdown" role="listbox" aria-label="Search results">
            {!query.trim() ? (
              <div className="p-3.5 space-y-2.5">
                <div className="text-[11px] font-semibold text-hv-muted">
                  Quick Search Suggestions
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['E04', 'DK992841004X', 'Daikin', 'Bosch', 'Living Room', 'MacBook'].map(
                    (sample) => (
                      <button
                        key={sample}
                        type="button"
                        onClick={() => {
                          setQuery(sample);
                          inputRef.current?.focus();
                        }}
                        className="px-2.5 py-1 rounded-md bg-hv-elevated hover:bg-hv-hover text-[11.5px] font-medium text-hv-text transition-colors"
                      >
                        {sample}
                      </button>
                    )
                  )}
                </div>
              </div>
            ) : hits.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12.5px] text-hv-muted">
                No assets, documents, or indexed manual pages matched "{query}".
              </div>
            ) : (
              <div className="hv-titlebar-search-results">
                {hits.map((hit, idx) => (
                  <div
                    key={hit.id}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`hv-titlebar-search-hit ${idx === activeIndex ? 'is-active' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="mt-0.5 p-1.5 rounded-md bg-hv-elevated text-hv-accent-fg shrink-0">
                          {hit.kind === 'manual_page' ? (
                            <BookOpen className="w-3.5 h-3.5" />
                          ) : hit.kind === 'document' ? (
                            <FileText className="w-3.5 h-3.5" />
                          ) : (
                            <Box className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-hv-text truncate">
                            {hit.title}
                          </div>
                          <div className="text-[11.5px] text-hv-muted">
                            {hit.subtitle}
                          </div>
                          <p className="text-[11.5px] text-hv-text/85 mt-0.5 line-clamp-2">
                            {hit.snippet}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {hit.kind === 'manual_page' && hit.documentId && (
                          <button
                            type="button"
                            onClick={() => {
                              onOpenDocument(hit.documentId!, hit.pageNumber ?? 1);
                              closeDropdown();
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-hv-accent hover:bg-hv-accent-hover text-white text-[11px] font-medium whitespace-nowrap"
                          >
                            Jump to Page {hit.pageNumber}
                          </button>
                        )}
                        {hit.documentId && (
                          <button
                            type="button"
                            onClick={() => {
                              onOpenDocument(hit.documentId!, hit.pageNumber ?? 1);
                              closeDropdown();
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-hv-elevated hover:bg-hv-hover text-[11px] font-medium text-hv-text whitespace-nowrap"
                          >
                            Open Manual
                          </button>
                        )}
                        {hit.assetId && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectAsset(hit.assetId!);
                              closeDropdown();
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-hv-border text-[11px] font-medium text-hv-text hover:bg-hv-hover whitespace-nowrap"
                          >
                            <span>Asset</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="px-3.5 py-1.5 bg-hv-subtle border-t border-hv-border flex items-center justify-between text-[10.5px] text-hv-muted">
              <span>↑↓ Navigate · Enter Open · Esc Close</span>
              <span>Offline SQLite + PDF.js Index</span>
            </div>
          </div>
        )}
      </div>

      {/* Right: Layout Toggles, Theme & Native Window Controls */}
      <div className="hv-titlebar-actions">
        <button
          type="button"
          onClick={onToggleSidebar}
          title={sidebarOpen ? 'Collapse navigation pane' : 'Expand navigation pane'}
          aria-label="Toggle navigation pane"
          className={`hv-titlebar-icon-btn ${sidebarOpen ? 'is-active' : ''}`}
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        {showInspectorToggle && (
          <button
            type="button"
            onClick={onToggleInspector}
            title={inspectorOpen ? 'Collapse inspector pane' : 'Expand inspector pane'}
            aria-label="Toggle inspector pane"
            className={`hv-titlebar-icon-btn ${inspectorOpen ? 'is-active' : ''}`}
          >
            <PanelRight className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={onToggleTheme}
          title={isDarkTheme(theme) ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label="Toggle theme"
          className="hv-titlebar-icon-btn"
        >
          {isDarkTheme(theme) ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="hv-titlebar-divider" aria-hidden="true" />

        <button
          type="button"
          onClick={() => void windowMinimize()}
          aria-label="Minimize window"
          title="Minimize"
          className="hv-titlebar-win-btn"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => void handleMaximize()}
          aria-label={maximized ? 'Restore window' : 'Maximize window'}
          title={maximized ? 'Restore' : 'Maximize'}
          className="hv-titlebar-win-btn"
        >
          {maximized ? <Copy className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => void windowClose()}
          aria-label="Close window"
          title="Close"
          className="hv-titlebar-win-btn is-close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

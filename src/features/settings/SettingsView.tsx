import {
  Archive,
  Bell,
  BookOpen,
  CheckCircle2,
  FolderOpen,
  HardDrive,
  Info,
  Moon,
  Palette,
  PanelLeft,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  AppSettings,
  BackupHistoryRecord,
  SidebarGroupsConfig,
  StorageConfig,
  ThemePreset,
} from '@/src/types/homevault';
import { DEFAULT_SIDEBAR_GROUPS, THEME_PRESETS } from '@/src/types/homevault';
import { homeVaultService } from '@/src/services/database/homeVaultService';
import { sendDesktopNotification } from '@/src/services/tauri/bridge';
import { BackupRestoreView } from '@/src/features/backups/BackupRestoreView';
import { AboutView } from '@/src/features/settings/AboutView';

export type SettingsTab =
  | 'general'
  | 'appearance'
  | 'preferences'
  | 'sidebar'
  | 'backups'
  | 'about';

interface SettingsViewProps {
  settings: AppSettings;
  backups: BackupHistoryRecord[];
  assetCount: number;
  documentCount: number;
  initialTab?: SettingsTab;
  onUpdateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  onRefreshAll: () => Promise<void>;
  onOpenOnboarding?: () => void;
}

export function SettingsView({
  settings,
  backups,
  assetCount,
  documentCount,
  initialTab = 'general',
  onUpdateSettings,
  onRefreshAll,
  onOpenOnboarding,
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [notifFeedback, setNotifFeedback] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [alertDaysInput, setAlertDaysInput] = useState(String(settings.warrantyAlertDays));
  const [storageConfig, setStorageConfig] = useState<StorageConfig | null>(null);
  const [storagePathInput, setStoragePathInput] = useState(settings.storagePath);
  const [migrateOnChange, setMigrateOnChange] = useState(true);
  const [storageFeedback, setStorageFeedback] = useState<string | null>(null);
  const [busyStorage, setBusyStorage] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setAlertDaysInput(String(settings.warrantyAlertDays));
  }, [settings.warrantyAlertDays]);

  useEffect(() => {
    void homeVaultService
      .getStorageConfig()
      .then((cfg) => {
        setStorageConfig(cfg);
        setStoragePathInput(cfg.storagePath);
      })
      .catch(() => {});
  }, [settings.storagePath]);

  const applySettings = async (partial: Partial<AppSettings>) => {
    setSaveError(null);
    try {
      await onUpdateSettings(partial);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save setting.');
    }
  };

  const commitAlertDays = () => {
    const parsed = Math.round(Number(alertDaysInput));
    const clamped = Number.isFinite(parsed) ? Math.min(180, Math.max(7, parsed)) : 30;
    setAlertDaysInput(String(clamped));
    if (clamped !== settings.warrantyAlertDays) {
      void applySettings({ warrantyAlertDays: clamped });
    }
  };

  const handleTestNotification = async () => {
    await sendDesktopNotification(
      'HomeVault Reminder Active',
      'Warranty expiry and maintenance notifications are configured locally.'
    );
    setNotifFeedback('Notification dispatched via native desktop / browser channel.');
    setTimeout(() => setNotifFeedback(null), 2500);
  };

  const navGroups: {
    group: string;
    items: {
      id: SettingsTab;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
    }[];
  }[] = [
    {
      group: 'Workspace',
      items: [
        { id: 'general', label: 'General', icon: Settings2 },
        { id: 'appearance', label: 'Appearance', icon: Palette },
        { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
        { id: 'sidebar', label: 'Sidebar', icon: PanelLeft },
      ],
    },
    {
      group: 'Data & Vault',
      items: [{ id: 'backups', label: 'Backup & Restore', icon: Archive }],
    },
    {
      group: 'Application',
      items: [{ id: 'about', label: 'About HomeVault', icon: Info }],
    },
  ];

  const lightThemes = THEME_PRESETS.filter((t) => t.mode === 'light');
  const darkThemes = THEME_PRESETS.filter((t) => t.mode === 'dark');

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left Settings Side Navigation Column */}
      <aside
        aria-label="Settings categories"
        className="w-[224px] shrink-0 h-full overflow-y-auto border-r border-hv-border bg-hv-subtle px-3.5 py-6 space-y-6 select-none"
      >
        <div className="px-2">
          <h1 className="text-[18px] font-semibold tracking-tight text-hv-text">
            Settings
          </h1>
          <p className="text-[12px] text-hv-muted mt-0.5">
            HomeVault Configuration
          </p>
        </div>

        <nav className="space-y-5">
          {navGroups.map((section) => (
            <div key={section.group}>
              <div className="px-2 pb-1.5 text-[11px] font-semibold tracking-wide text-hv-muted">
                {section.group}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      aria-current={active ? 'page' : undefined}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hv-accent-fg ${
                        active
                          ? 'bg-hv-card text-hv-text font-semibold shadow-2xs border border-hv-border'
                          : 'text-hv-text/85 hover:bg-hv-hover font-medium border border-transparent'
                      }`}
                    >
                      <item.icon
                        className={`w-4 h-4 shrink-0 ${
                          active ? 'text-hv-accent-fg' : 'text-hv-muted'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Right Settings Content Pane */}
      <div className="flex-1 min-w-0 h-full overflow-y-auto px-6 py-6 sm:px-10 sm:py-7">
        <div className="max-w-[920px] mx-auto space-y-6">
          {saveError && (
            <div className="p-3 rounded-xl bg-hv-danger/10 border border-hv-danger/25 text-[12.5px] text-hv-danger">
              {saveError}
            </div>
          )}

          {activeTab === 'general' && (
            <>
              <div>
                <h2 className="text-[20px] font-semibold tracking-tight text-hv-text">
                  General
                </h2>
                <p className="text-[13px] text-hv-muted mt-0.5">
                  Overview of your household vault, regional conventions, and runtime environment.
                </p>
              </div>

              <section className="bg-hv-card border border-hv-border rounded-xl divide-y divide-hv-border">
                <SettingRow
                  title="Primary Residence"
                  description="Active household label displayed across reports and the sidebar."
                >
                  <span className="text-[13px] font-medium text-hv-text">
                    {settings.residenceName}
                  </span>
                </SettingRow>

                <SettingRow
                  title="Household Owner"
                  description="Primary owner associated with exported valuation packages."
                >
                  <span className="text-[13px] font-medium text-hv-text">
                    {settings.ownerName}
                  </span>
                </SettingRow>

                <SettingRow
                  title="Locale & Date Format"
                  description="Regional formatting applied across asset schedules and warranties."
                >
                  <span className="text-[13px] font-medium text-hv-text">
                    en-IN · DD MMM YYYY
                  </span>
                </SettingRow>

                <SettingRow
                  title="Vault Summary"
                  description="Current records indexed in your local offline database."
                >
                  <span className="text-[13px] font-medium tabular-nums text-hv-text">
                    {assetCount} assets · {documentCount} documents
                  </span>
                </SettingRow>

                <SettingRow
                  title="Runtime Environment"
                  description="Execution mode for storage, PDF processing, and OS notifications."
                >
                  <span className="text-[13px] font-medium text-hv-success">
                    {homeVaultService.isNativeDesktop()
                      ? 'Tauri 2 Native Desktop'
                      : 'Browser Preview'}
                  </span>
                </SettingRow>
              </section>

              <section className="bg-hv-card border border-hv-border rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <HardDrive className="w-4 h-4 text-hv-accent-fg mt-0.5 shrink-0" />
                    <div>
                      <h3 className="text-[14.5px] font-semibold text-hv-text">
                        Authorized Document Storage Folder
                      </h3>
                      <p className="text-[12.5px] text-hv-muted mt-0.5">
                        Uploaded invoices, warranties, manuals, and DOCX/PDF files are saved inside a structured hierarchy here.
                      </p>
                    </div>
                  </div>
                  <span className="text-[12px] font-medium text-hv-accent-fg">
                    {storageConfig?.isCustom ? 'Custom Location' : 'Default Location'}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    aria-label="Authorized document storage folder path"
                    value={storagePathInput}
                    onChange={(e) => setStoragePathInput(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-hv-subtle border border-hv-border-strong font-mono text-[12px] text-hv-text"
                  />
                  {homeVaultService.isNativeDesktop() && (
                    <button
                      type="button"
                      disabled={busyStorage}
                      onClick={() => {
                        setSaveError(null);
                        setStorageFeedback(null);
                        setBusyStorage(true);
                        void homeVaultService
                          .chooseAndSetStorageLocation(migrateOnChange)
                          .then(async (cfg) => {
                            if (cfg) {
                              setStorageConfig(cfg);
                              setStoragePathInput(cfg.storagePath);
                              await onRefreshAll();
                              setStorageFeedback('Storage folder updated and active.');
                            }
                          })
                          .catch((err) =>
                            setSaveError(
                              err instanceof Error ? err.message : 'Failed to change storage folder.'
                            )
                          )
                          .finally(() => setBusyStorage(false));
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-hv-accent hover:bg-hv-accent-hover text-white text-[12.5px] font-medium shrink-0"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Browse Folder</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyStorage || !storagePathInput.trim()}
                    onClick={() => {
                      setSaveError(null);
                      setStorageFeedback(null);
                      setBusyStorage(true);
                      void homeVaultService
                        .setStorageLocation(storagePathInput, migrateOnChange)
                        .then(async (cfg) => {
                          setStorageConfig(cfg);
                          setStoragePathInput(cfg.storagePath);
                          await onRefreshAll();
                          setStorageFeedback('Storage folder updated.');
                        })
                        .catch((err) =>
                          setSaveError(
                            err instanceof Error ? err.message : 'Failed to update storage folder.'
                          )
                        )
                        .finally(() => setBusyStorage(false));
                    }}
                    className="px-3.5 py-2 rounded-lg border border-hv-border-strong bg-hv-subtle hover:bg-hv-hover text-[12.5px] font-medium text-hv-text shrink-0"
                  >
                    Apply Path
                  </button>
                  {storageConfig?.isCustom && (
                    <button
                      type="button"
                      disabled={busyStorage}
                      onClick={() => {
                        setSaveError(null);
                        setStorageFeedback(null);
                        setBusyStorage(true);
                        void homeVaultService
                          .setStorageLocation('', migrateOnChange)
                          .then(async (cfg) => {
                            setStorageConfig(cfg);
                            setStoragePathInput(cfg.storagePath);
                            await onRefreshAll();
                            setStorageFeedback('Restored default storage folder.');
                          })
                          .catch((err) =>
                            setSaveError(
                              err instanceof Error ? err.message : 'Failed to reset storage folder.'
                            )
                          )
                          .finally(() => setBusyStorage(false));
                      }}
                      className="px-3 py-2 rounded-lg text-[12.5px] font-medium text-hv-muted hover:text-hv-text shrink-0"
                    >
                      Reset Default
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-[12.5px] text-hv-text cursor-pointer">
                    <input
                      type="checkbox"
                      checked={migrateOnChange}
                      onChange={(e) => setMigrateOnChange(e.target.checked)}
                      className="rounded accent-hv-accent"
                    />
                    <span>Move existing managed files when changing folder</span>
                  </label>
                  <span className="text-[11.5px] font-mono text-hv-muted">
                    Layout: Documents/&lt;Category&gt;/&lt;Year&gt;/&lt;id&gt;_file
                  </span>
                </div>

                {storageFeedback && (
                  <div className="text-[12.5px] text-hv-success font-medium">{storageFeedback}</div>
                )}
              </section>

              <section className="bg-hv-card border border-hv-border rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-[14px] font-semibold text-hv-text">
                    Onboarding &amp; Vault Data
                  </h3>
                  <p className="text-[12.5px] text-hv-muted mt-0.5">
                    Reopen the guided setup walkthrough, load sample records into an empty vault, or start fresh.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {onOpenOnboarding && (
                    <button
                      type="button"
                      onClick={onOpenOnboarding}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-hv-border-strong text-[12.5px] font-medium text-hv-text hover:bg-hv-hover transition-colors"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-hv-accent-fg" />
                      <span>Launch Setup Guide</span>
                    </button>
                  )}
                  {assetCount === 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        void homeVaultService
                          .loadSampleData()
                          .then(onRefreshAll)
                          .catch((err) =>
                            setSaveError(
                              err instanceof Error ? err.message : 'Failed to load sample data.'
                            )
                          )
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-hv-border-strong text-[12.5px] font-medium text-hv-text hover:bg-hv-hover transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-hv-accent-fg" />
                      <span>Load Sample Data</span>
                    </button>
                  )}
                  {!homeVaultService.isNativeDesktop() && (
                    <button
                      type="button"
                      onClick={() =>
                        void homeVaultService
                          .resetCleanVault()
                          .then(onRefreshAll)
                          .catch((err) =>
                            setSaveError(
                              err instanceof Error ? err.message : 'Failed to reset vault.'
                            )
                          )
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-hv-border-strong text-[12.5px] font-medium text-hv-text hover:bg-hv-hover transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset to Clean Vault</span>
                    </button>
                  )}
                </div>
              </section>
            </>
          )}

          {activeTab === 'appearance' && (
            <>
              <div>
                <h2 className="text-[20px] font-semibold tracking-tight text-hv-text">
                  Appearance
                </h2>
                <p className="text-[13px] text-hv-muted mt-0.5">
                  Choose a calibrated surface theme. HomeVault Signature is available in both Light and Dark modes alongside two curated daylight and dark-room palettes, tuned for WCAG AA readability.
                </p>
              </div>

              {/* Light Mode Themes */}
              <section className="bg-hv-card border border-hv-border rounded-xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sun className="w-4 h-4 text-hv-accent-fg shrink-0" />
                    <div>
                      <h3 className="text-[14.5px] font-semibold text-hv-text">
                        Light Mode Themes
                      </h3>
                      <p className="text-[12px] text-hv-muted">
                        Crisp daylight surfaces engineered for bright rooms and extended reading.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {lightThemes.map((preset) => (
                    <ThemePresetCard
                      key={preset.id}
                      preset={preset}
                      selected={settings.theme === preset.id}
                      onSelect={() => void applySettings({ theme: preset.id })}
                    />
                  ))}
                </div>
              </section>

              {/* Dark Mode Themes */}
              <section className="bg-hv-card border border-hv-border rounded-xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Moon className="w-4 h-4 text-hv-accent-fg shrink-0" />
                    <div>
                      <h3 className="text-[14.5px] font-semibold text-hv-text">
                        Dark Mode Themes
                      </h3>
                      <p className="text-[12px] text-hv-muted">
                        Low-glare night surfaces with high-contrast text and luminous focal accents.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {darkThemes.map((preset) => (
                    <ThemePresetCard
                      key={preset.id}
                      preset={preset}
                      selected={settings.theme === preset.id}
                      onSelect={() => void applySettings({ theme: preset.id })}
                    />
                  ))}
                </div>
              </section>
            </>
          )}

          {activeTab === 'preferences' && (
            <>
              <div>
                <h2 className="text-[20px] font-semibold tracking-tight text-hv-text">
                  Preferences
                </h2>
                <p className="text-[13px] text-hv-muted mt-0.5">
                  Configure currency formatting, warranty alert lead times, and desktop reminders.
                </p>
              </div>

              <section className="bg-hv-card border border-hv-border rounded-xl divide-y divide-hv-border">
                <SettingRow
                  title="Default Currency"
                  description="Used for asset valuations, maintenance spend, and insurance PDF reports."
                >
                  <select
                    value={settings.currency}
                    onChange={(e) => void applySettings({ currency: e.target.value })}
                    className="w-56 px-3 py-2 rounded-lg bg-hv-subtle border border-hv-border-strong text-[13px] text-hv-text"
                  >
                    <option value="INR">INR (₹) — Indian Rupee</option>
                    <option value="USD">USD ($) — US Dollar</option>
                    <option value="EUR">EUR (€) — Euro</option>
                  </select>
                </SettingRow>

                <SettingRow
                  title="Expiring Soon Threshold"
                  description="Flag warranties as Expiring Soon when fewer than this many days remain (7–180)."
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={7}
                      max={180}
                      value={alertDaysInput}
                      onChange={(e) => setAlertDaysInput(e.target.value)}
                      onBlur={commitAlertDays}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitAlertDays();
                      }}
                      className="w-24 px-3 py-2 rounded-lg bg-hv-subtle border border-hv-border-strong text-[13px] tabular-nums text-hv-text"
                    />
                    <span className="text-[12.5px] text-hv-muted">days</span>
                  </div>
                </SettingRow>

                <SettingRow
                  title="Desktop Notifications"
                  description="Send native reminders for upcoming maintenance tasks and expiring warranties."
                >
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-[13px] text-hv-text cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.notificationsEnabled}
                        onChange={(e) =>
                          void applySettings({ notificationsEnabled: e.target.checked })
                        }
                        className="rounded accent-hv-accent"
                      />
                      <span>Enabled</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleTestNotification()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-hv-elevated hover:bg-hv-hover text-[12px] font-medium text-hv-text transition-colors"
                    >
                      <Bell className="w-3.5 h-3.5 text-hv-accent-fg" />
                      <span>Test</span>
                    </button>
                  </div>
                </SettingRow>
              </section>

              {notifFeedback && (
                <div className="text-[12.5px] text-hv-success font-medium">{notifFeedback}</div>
              )}
            </>
          )}

          {activeTab === 'sidebar' && (
            <>
              <div>
                <h2 className="text-[20px] font-semibold tracking-tight text-hv-text">
                  Sidebar
                </h2>
                <p className="text-[13px] text-hv-muted mt-0.5">
                  Choose which navigation groups appear in the left sidebar.
                </p>
              </div>

              <section className="bg-hv-card border border-hv-border rounded-xl divide-y divide-hv-border">
                {(
                  [
                    {
                      key: 'smartViews',
                      title: 'Smart Views',
                      description:
                        'All Assets, Expiring Soon, Maintenance Due, In Repair, Recently Added',
                    },
                    {
                      key: 'propertyOperations',
                      title: 'Property & Operations',
                      description:
                        'Property Specs, Documents & Vault, Insurance & Valuation, Maintenance Center',
                    },
                    {
                      key: 'mainSpaces',
                      title: 'Spaces · Main Residence',
                      description:
                        'Living Room, Kitchen, Master Bedroom, Utility & Garage',
                    },
                    {
                      key: 'otherCategories',
                      title: 'Other Categories',
                      description: 'Vehicles, Everyday Carry',
                    },
                  ] as const
                ).map((group) => {
                  const enabled = settings.sidebarGroups[group.key];
                  const toggle = () => {
                    const next: SidebarGroupsConfig = {
                      ...settings.sidebarGroups,
                      [group.key]: !enabled,
                    };
                    void applySettings({ sidebarGroups: next });
                  };
                  return (
                    <SettingRow
                      key={group.key}
                      title={group.title}
                      description={group.description}
                    >
                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        aria-label={`Toggle ${group.title}`}
                        onClick={toggle}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hv-accent-fg ${
                          enabled ? 'bg-hv-accent' : 'bg-hv-border-strong'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                            enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </SettingRow>
                  );
                })}
              </section>

              <div className="flex items-center justify-between gap-3 text-[12.5px] text-hv-muted">
                <span>
                  {Object.values(settings.sidebarGroups).filter(Boolean).length} of 4 sidebar
                  groups enabled
                </span>
                <button
                  type="button"
                  onClick={() => void applySettings({ sidebarGroups: DEFAULT_SIDEBAR_GROUPS })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-hv-border-strong text-[12.5px] font-medium text-hv-text hover:bg-hv-hover transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Show All Groups</span>
                </button>
              </div>
            </>
          )}

          {activeTab === 'backups' && (
            <BackupRestoreView
              embedded
              backups={backups}
              assetCount={assetCount}
              documentCount={documentCount}
              onRefresh={onRefreshAll}
            />
          )}

          {activeTab === 'about' && <AboutView embedded />}
        </div>
      </div>
    </div>
  );
}

function ThemePresetCard({
  preset,
  selected,
  onSelect,
}: {
  preset: ThemePreset;
  selected: boolean;
  onSelect: () => void;
}) {
  const { palette } = preset;
  const isSignature = preset.family === 'HomeVault Signature';
  const modeLabel = preset.mode === 'light' ? 'Light' : 'Dark';

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`text-left rounded-xl border p-4 transition-all flex flex-col justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hv-accent-fg ${
        selected
          ? 'border-hv-accent-fg bg-hv-accent-fg/[0.06] ring-1 ring-hv-accent-fg/35'
          : 'border-hv-border hover:bg-hv-hover/60 hover:border-hv-border-strong'
      }`}
    >
      <div className="space-y-3 w-full">
        {/* Live Mini Workspace Preview rendered with the theme's actual palette */}
        <div
          className="h-24 rounded-lg overflow-hidden flex border"
          style={{
            backgroundColor: palette.bg,
            borderColor: palette.border,
          }}
        >
          {/* Mini Sidebar */}
          <div
            className="w-12 h-full p-2 flex flex-col justify-between border-r"
            style={{
              backgroundColor: palette.sidebar,
              borderColor: palette.border,
            }}
          >
            <div className="space-y-1.5">
              <div
                className="h-2 w-full rounded-xs"
                style={{ backgroundColor: palette.accentFg }}
              />
              <div
                className="h-1.5 w-3/4 rounded-xs opacity-60"
                style={{ backgroundColor: palette.textSecondary }}
              />
              <div
                className="h-1.5 w-5/6 rounded-xs opacity-45"
                style={{ backgroundColor: palette.textSecondary }}
              />
            </div>
            <div
              className="w-3.5 h-3.5 rounded-full"
              style={{ backgroundColor: palette.accent }}
            />
          </div>

          {/* Mini Workspace Canvas */}
          <div className="flex-1 p-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <div
                className="h-2 w-16 rounded-xs"
                style={{ backgroundColor: palette.textPrimary }}
              />
              <div
                className="h-3.5 w-9 rounded-xs"
                style={{ backgroundColor: palette.accent }}
              />
            </div>
            <div
              className="p-2 rounded-md border space-y-1"
              style={{
                backgroundColor: palette.card,
                borderColor: palette.border,
              }}
            >
              <div
                className="h-2 w-20 rounded-xs"
                style={{ backgroundColor: palette.textPrimary }}
              />
              <div
                className="h-1.5 w-28 rounded-xs"
                style={{ backgroundColor: palette.textSecondary }}
              />
            </div>
          </div>
        </div>

        {/* Title & Description */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-[13.5px] font-semibold truncate ${
                selected ? 'text-hv-accent-fg' : 'text-hv-text'
              }`}
            >
              {preset.name}
            </span>
            {selected && <CheckCircle2 className="w-4 h-4 text-hv-accent-fg shrink-0" />}
          </div>
          <div className="text-[11.5px] font-medium text-hv-muted mt-0.5">
            {isSignature ? `Signature · ${modeLabel} Mode` : `${modeLabel} Mode`}
          </div>
          <p className="text-[12px] text-hv-muted mt-1.5 leading-relaxed">
            {preset.description}
          </p>
        </div>
      </div>

      {/* Color Swatch Strip */}
      <div className="flex items-center justify-between pt-2 border-t border-hv-border w-full">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {[palette.bg, palette.sidebar, palette.card, palette.accent, palette.textPrimary].map(
            (hex, i) => (
              <span
                key={`${preset.id}-swatch-${i}`}
                className="w-3.5 h-3.5 rounded-sm border"
                style={{
                  backgroundColor: hex,
                  borderColor: palette.borderStrong,
                }}
              />
            )
          )}
        </div>
        <span className="text-[11px] font-medium text-hv-muted">WCAG AA</span>
      </div>
    </button>
  );
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium text-hv-text">{title}</div>
        <div className="text-[12px] text-hv-muted mt-0.5">{description}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { TitleBar } from '@/src/components/layout/TitleBar';
import { Sidebar } from '@/src/components/navigation/Sidebar';
import { AssetDashboard } from '@/src/components/assets/AssetDashboard';
import { AssetInspector } from '@/src/components/assets/AssetInspector';
import { AssetFormModal } from '@/src/components/modals/AssetFormModal';
import { DocumentViewerModal } from '@/src/components/modals/DocumentViewerModal';
import { InsuranceExportModal } from '@/src/components/modals/InsuranceExportModal';
import { OnboardingModal } from '@/src/components/modals/OnboardingModal';
import { PropertySpecsView } from '@/src/features/property/PropertySpecsView';
import { DocumentVaultView } from '@/src/features/vault/DocumentVaultView';
import { WarrantyCenterView } from '@/src/features/warranties/WarrantyCenterView';
import { MaintenanceCenterView } from '@/src/features/maintenance/MaintenanceCenterView';
import { SettingsView } from '@/src/features/settings/SettingsView';
import { ProfileView } from '@/src/features/settings/ProfileView';
import { useHomeVault } from '@/src/hooks/useHomeVault';
import { homeVaultService } from '@/src/services/database/homeVaultService';
import type {
  AssetRecord,
  DocumentWithLinks,
  NavSection,
  SmartViewType,
  UpsertAssetInput,
} from '@/src/types/homevault';
import { getToggledTheme } from '@/src/types/homevault';

export default function App() {
  const {
    loading,
    error,
    assets,
    categories,
    locations,
    warranties,
    maintenanceTasks,
    maintenanceHistory,
    documents,
    propertySpecs,
    backups,
    settings,
    metrics,
    refreshAll,
    updateTheme,
    updateSettings,
  } = useHomeVault();

  const [activeSection, setActiveSection] = useState<NavSection>('assets');
  const [activeSmartView, setActiveSmartView] = useState<SmartViewType>('all');
  const [activeRoomFilter, setActiveRoomFilter] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [searchFocusSignal, setSearchFocusSignal] = useState(0);

  // Modals
  const [assetFormOpen, setAssetFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetRecord | null>(null);
  const [insuranceExportOpen, setInsuranceExportOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<{
    doc: DocumentWithLinks;
    page: number;
  } | null>(null);

  useEffect(() => {
    if (!loading && !onboardingChecked) {
      setOnboardingChecked(true);
      if (!settings.onboardingCompleted) {
        setOnboardingOpen(true);
      }
    }
  }, [loading, onboardingChecked, settings.onboardingCompleted]);

  // Select first asset by default when assets exist and none selected
  useEffect(() => {
    if (!selectedAssetId && assets.length > 0) {
      const daikin = assets.find((a) => a.name.includes('Daikin'));
      setSelectedAssetId(daikin ? daikin.id : assets[0].id);
    }
  }, [assets, selectedAssetId]);

  // Global keyboard shortcuts: Ctrl+K focuses inline search, Ctrl+N opens new asset form
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchFocusSignal((n) => n + 1);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setEditingAsset(null);
        setAssetFormOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const selectedAsset = useMemo(
    () => assets.find((a) => a.id === selectedAssetId) ?? null,
    [assets, selectedAssetId]
  );

  const handleSaveAsset = async (input: UpsertAssetInput) => {
    const savedId = await homeVaultService.upsertAsset(input);
    await refreshAll();
    setSelectedAssetId(savedId);
    setActiveSection('assets');
  };

  const handleDeleteAsset = async (assetId: string) => {
    await homeVaultService.deleteAsset(assetId);
    await refreshAll();
    if (selectedAssetId === assetId) {
      setSelectedAssetId(null);
    }
  };

  const handleOpenDocumentById = (documentId: string, pageNumber = 1) => {
    const found = documents.find((d) => d.id === documentId);
    if (found) {
      setViewerDoc({ doc: found, page: pageNumber });
    }
  };

  const showInspector = activeSection === 'assets' && inspectorOpen;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-hv-bg text-hv-text">
      <TitleBar
        theme={settings.theme}
        onToggleTheme={() => void updateTheme(getToggledTheme(settings.theme))}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((v) => !v)}
        showInspectorToggle={activeSection === 'assets'}
        searchFocusSignal={searchFocusSignal}
        onSelectAsset={(assetId) => {
          setSelectedAssetId(assetId);
          setActiveSection('assets');
          setInspectorOpen(true);
        }}
        onOpenDocument={handleOpenDocumentById}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {sidebarOpen && (
          <Sidebar
            activeSection={activeSection}
            activeSmartView={activeSmartView}
            activeRoomFilter={activeRoomFilter}
            onSelectSmartView={(view) => {
              setActiveSection('assets');
              setActiveRoomFilter(null);
              setActiveSmartView(view);
            }}
            onSelectSection={(sec) => {
              setActiveSection(sec);
            }}
            onSelectRoom={(room) => {
              setActiveSection('assets');
              setActiveRoomFilter(room);
            }}
            counts={{
              all: metrics.totalAssets,
              expiring: metrics.expiringSoonCount,
              maintenanceDue: metrics.maintenanceDueCount,
              inRepair: metrics.inRepairCount,
              roomCounts: metrics.roomCounts,
            }}
            ownerName={settings.ownerName}
            residenceName={settings.residenceName}
            ownerEmail={settings.ownerEmail}
            sidebarGroups={settings.sidebarGroups}
          />
        )}

        {/* Center Workspace */}
        <main className="flex-1 min-w-0 h-full overflow-hidden">
          {loading ? (
            <div className="h-full flex items-center justify-center text-[13px] text-hv-muted">
              Loading HomeVault local database...
            </div>
          ) : error ? (
            <div className="p-6">
              <div className="p-4 rounded-xl bg-hv-danger/10 border border-hv-danger/25 text-[13px] text-hv-danger">
                {error}
              </div>
            </div>
          ) : activeSection === 'assets' ? (
            <AssetDashboard
              assets={assets}
              warranties={warranties}
              maintenanceTasks={maintenanceTasks}
              warrantyAlertDays={settings.warrantyAlertDays}
              selectedAssetId={selectedAssetId}
              onSelectAsset={(id) => {
                setSelectedAssetId(id);
                setInspectorOpen(true);
              }}
              smartView={activeSmartView}
              roomFilter={activeRoomFilter}
              onAddAsset={() => {
                setEditingAsset(null);
                setAssetFormOpen(true);
              }}
              onOpenInsuranceExport={() => setInsuranceExportOpen(true)}
              onOpenOnboarding={() => setOnboardingOpen(true)}
              onLoadSampleData={async () => {
                await homeVaultService.loadSampleData();
                await refreshAll();
              }}
              onOpenVault={() => setActiveSection('vault')}
            />
          ) : activeSection === 'property' ? (
            <PropertySpecsView specs={propertySpecs} onRefresh={refreshAll} />
          ) : activeSection === 'vault' ? (
            <DocumentVaultView
              documents={documents}
              assets={assets}
              onOpenDocument={(doc, page = 1) => setViewerDoc({ doc, page })}
              onRefresh={refreshAll}
            />
          ) : activeSection === 'warranties' ? (
            <WarrantyCenterView
              assets={assets}
              warranties={warranties}
              warrantyAlertDays={settings.warrantyAlertDays}
              onSelectAsset={(id) => {
                setSelectedAssetId(id);
                setActiveSection('assets');
                setInspectorOpen(true);
              }}
              onOpenInsuranceExport={() => setInsuranceExportOpen(true)}
              onRefresh={refreshAll}
            />
          ) : activeSection === 'maintenance' ? (
            <MaintenanceCenterView
              assets={assets}
              tasks={maintenanceTasks}
              history={maintenanceHistory}
              onSelectAsset={(id) => {
                setSelectedAssetId(id);
                setActiveSection('assets');
                setInspectorOpen(true);
              }}
              onRefresh={refreshAll}
            />
          ) : activeSection === 'settings' ||
            activeSection === 'backups' ||
            activeSection === 'about' ? (
            <SettingsView
              settings={settings}
              backups={backups}
              assetCount={assets.length}
              documentCount={documents.length}
              initialTab={
                activeSection === 'backups'
                  ? 'backups'
                  : activeSection === 'about'
                    ? 'about'
                    : 'general'
              }
              onUpdateSettings={updateSettings}
              onRefreshAll={refreshAll}
              onOpenOnboarding={() => setOnboardingOpen(true)}
            />
          ) : (
            <ProfileView
              settings={settings}
              assetCount={assets.length}
              documentCount={documents.length}
              onUpdateSettings={updateSettings}
            />
          )}
        </main>

        {/* Right Detail Inspector */}
        {showInspector && (
          <AssetInspector
            asset={selectedAsset}
            warranties={warranties}
            tasks={maintenanceTasks}
            history={maintenanceHistory}
            documents={documents}
            warrantyAlertDays={settings.warrantyAlertDays}
            onEditAsset={(asset) => {
              setEditingAsset(asset);
              setAssetFormOpen(true);
            }}
            onDeleteAsset={(id) => void handleDeleteAsset(id)}
            onOpenDocument={(doc, page = 1) => setViewerDoc({ doc, page })}
            onRefresh={refreshAll}
          />
        )}
      </div>

      {/* Modals */}
      {assetFormOpen && (
        <AssetFormModal
          isOpen={assetFormOpen}
          editingAsset={editingAsset}
          categories={categories}
          locations={locations}
          onClose={() => {
            setAssetFormOpen(false);
            setEditingAsset(null);
          }}
          onSave={handleSaveAsset}
        />
      )}

      <InsuranceExportModal
        isOpen={insuranceExportOpen}
        assets={assets}
        locations={locations}
        documents={documents}
        onClose={() => setInsuranceExportOpen(false)}
      />

      <DocumentViewerModal
        document={viewerDoc?.doc ?? null}
        initialPage={viewerDoc?.page ?? 1}
        onClose={() => setViewerDoc(null)}
        onRefresh={refreshAll}
      />

      <OnboardingModal
        isOpen={onboardingOpen}
        settings={settings}
        assetCount={assets.length}
        onClose={() => {
          setOnboardingOpen(false);
          if (!settings.onboardingCompleted) {
            void updateSettings({ onboardingCompleted: true });
          }
        }}
        onComplete={async ({ ownerName, residenceName, storagePath, loadSample }) => {
          if (storagePath && storagePath !== settings.storagePath) {
            await homeVaultService.setStorageLocation(storagePath, true);
          }
          await updateSettings({
            ownerName,
            residenceName,
            onboardingCompleted: true,
          });
          if (loadSample) {
            await homeVaultService.loadSampleData();
          }
          await refreshAll();
          setOnboardingOpen(false);
        }}
      />
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AppSettings,
  AppTheme,
  AssetRecord,
  BackupHistoryRecord,
  Category,
  DocumentWithLinks,
  Location,
  MaintenanceHistoryRecord,
  MaintenanceTaskRecord,
  PropertySpecsBundle,
  WarrantyRecord,
} from '@/src/types/homevault';
import { APP_BRAND } from '@/src/constants';
import { DEFAULT_SETTINGS, isDarkTheme } from '@/src/types/homevault';
import { homeVaultService } from '@/src/services/database/homeVaultService';
import { evaluateMaintenanceTask, evaluateWarranty } from '@/src/utils/format';

export function useHomeVault() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [warranties, setWarranties] = useState<WarrantyRecord[]>([]);
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTaskRecord[]>([]);
  const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceHistoryRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentWithLinks[]>([]);
  const [propertySpecs, setPropertySpecs] = useState<PropertySpecsBundle>({
    paintRecords: [],
    breakers: [],
    network: [],
    utilities: [],
  });
  const [backups, setBackups] = useState<BackupHistoryRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const refreshAll = useCallback(async () => {
    try {
      setError(null);
      const [
        assetList,
        catList,
        locList,
        warList,
        taskList,
        histList,
        docList,
        propBundle,
        backupList,
        appSettings,
      ] = await Promise.all([
        homeVaultService.listAssets(),
        homeVaultService.listCategories(),
        homeVaultService.listLocations(),
        homeVaultService.listWarranties(),
        homeVaultService.listMaintenanceTasks(),
        homeVaultService.listMaintenanceHistory(),
        homeVaultService.listDocuments(),
        homeVaultService.getPropertySpecs(),
        homeVaultService.listBackupHistory(),
        homeVaultService.getSettings(),
      ]);

      setAssets(assetList);
      setCategories(catList);
      setLocations(locList);
      setWarranties(warList);
      setMaintenanceTasks(taskList);
      setMaintenanceHistory(histList);
      setDocuments(docList);
      setPropertySpecs(propBundle);
      setBackups(backupList);
      setSettings(appSettings);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to load ${APP_BRAND.name} data.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const root = document.documentElement;
    const dark = isDarkTheme(settings.theme);
    root.dataset.theme = settings.theme;
    root.classList.toggle('dark', dark);
    root.style.colorScheme = dark ? 'dark' : 'light';
  }, [settings.theme]);

  const metrics = useMemo(() => {
    const totalValuation = assets.reduce((sum, a) => sum + (a.purchasePrice || 0), 0);

    const warrantyByAsset = new Map<string, WarrantyRecord>();
    for (const w of warranties) {
      const existing = warrantyByAsset.get(w.assetId);
      if (!existing || w.expiryDate > existing.expiryDate) {
        warrantyByAsset.set(w.assetId, w);
      }
    }

    let expiringSoonCount = 0;
    let activeWarrantyCount = 0;
    let expiredWarrantyCount = 0;
    let coveredValuation = 0;

    for (const a of assets) {
      const w = warrantyByAsset.get(a.id);
      const evalRes = evaluateWarranty(w, settings.warrantyAlertDays);
      if (evalRes.health === 'expiring_soon') {
        expiringSoonCount += 1;
        activeWarrantyCount += 1;
        coveredValuation += a.purchasePrice;
      } else if (evalRes.health === 'active') {
        activeWarrantyCount += 1;
        coveredValuation += a.purchasePrice;
      } else if (evalRes.health === 'expired') {
        expiredWarrantyCount += 1;
      }
    }

    const maintenanceDueTasks = maintenanceTasks.filter((t) => {
      const status = evaluateMaintenanceTask(t).health;
      return status === 'due_today' || status === 'overdue';
    });

    const inRepairCount = assets.filter((a) => a.status === 'in_repair').length;

    const roomCounts = new Map<string, number>();
    for (const a of assets) {
      roomCounts.set(a.locationName, (roomCounts.get(a.locationName) ?? 0) + 1);
    }

    return {
      totalAssets: assets.length,
      totalValuation,
      coveredValuation,
      activeWarrantyCount,
      expiringSoonCount,
      expiredWarrantyCount,
      maintenanceDueCount: maintenanceDueTasks.length,
      inRepairCount,
      roomCounts,
      warrantyByAsset,
    };
  }, [assets, warranties, maintenanceTasks, settings.warrantyAlertDays]);

  const updateTheme = useCallback(async (theme: AppTheme) => {
    const next = await homeVaultService.updateSettings({ theme });
    setSettings(next);
  }, []);

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const next = await homeVaultService.updateSettings(partial);
    setSettings(next);
  }, []);

  return {
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
  };
}

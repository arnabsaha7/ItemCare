import type {
  AppSettings,
  AssetRecord,
  BackupHistoryRecord,
  BackupManifest,
  Category,
  DocumentCategory,
  DocumentWithLinks,
  ElectricalBreaker,
  InsuranceExportRequest,
  InsuranceExportResult,
  IntegrityReport,
  Location,
  MaintenanceHistoryRecord,
  MaintenanceTaskRecord,
  NetworkSetting,
  PaintRecord,
  PropertySpecsBundle,
  SearchHit,
  StorageConfig,
  UpsertAssetInput,
  UpsertMaintenanceTaskInput,
  UpsertWarrantyInput,
  UtilityRecord,
  WarrantyRecord,
} from '@/src/types/homevault';
import {
  APP_BRAND,
  BACKUP_CONFIG,
  SUPPORTED_DOCUMENT_EXTENSIONS,
} from '@/src/constants';
import { normalizeSettings, normalizeTheme } from '@/src/types/homevault';
import { invokeTauri, isTauriRuntime, pickNativeDirectory, pickNativeFile, saveNativeFile } from '@/src/services/tauri/bridge';
import { browserPreviewAdapter, getPreviewBlob } from './browserPreviewAdapter';
import { extractPdfPages, getSeededBoschManualPdfBytes } from '@/src/utils/pdfEngine';

export const homeVaultService = {
  isNativeDesktop(): boolean {
    return isTauriRuntime();
  },

  async listAssets(): Promise<AssetRecord[]> {
    if (isTauriRuntime()) return invokeTauri<AssetRecord[]>('list_assets');
    return browserPreviewAdapter.listAssets();
  },

  async listCategories(): Promise<Category[]> {
    if (isTauriRuntime()) return invokeTauri<Category[]>('list_categories');
    return browserPreviewAdapter.listCategories();
  },

  async listLocations(): Promise<Location[]> {
    if (isTauriRuntime()) return invokeTauri<Location[]>('list_locations');
    return browserPreviewAdapter.listLocations();
  },

  async upsertAsset(input: UpsertAssetInput): Promise<string> {
    if (isTauriRuntime()) return invokeTauri<string>('upsert_asset', { input });
    return browserPreviewAdapter.upsertAsset(input);
  },

  async deleteAsset(assetId: string): Promise<void> {
    if (isTauriRuntime()) return invokeTauri<void>('delete_asset', { assetId });
    return browserPreviewAdapter.deleteAsset(assetId);
  },

  async listWarranties(): Promise<WarrantyRecord[]> {
    if (isTauriRuntime()) return invokeTauri<WarrantyRecord[]>('list_warranties');
    return browserPreviewAdapter.listWarranties();
  },

  async upsertWarranty(input: UpsertWarrantyInput): Promise<WarrantyRecord> {
    if (isTauriRuntime()) return invokeTauri<WarrantyRecord>('upsert_warranty', { input });
    return browserPreviewAdapter.upsertWarranty(input);
  },

  async deleteWarranty(warrantyId: string): Promise<void> {
    if (isTauriRuntime()) return invokeTauri<void>('delete_warranty', { warrantyId });
    return browserPreviewAdapter.deleteWarranty(warrantyId);
  },

  async listMaintenanceTasks(): Promise<MaintenanceTaskRecord[]> {
    if (isTauriRuntime()) return invokeTauri<MaintenanceTaskRecord[]>('list_maintenance_tasks');
    return browserPreviewAdapter.listMaintenanceTasks();
  },

  async listMaintenanceHistory(): Promise<MaintenanceHistoryRecord[]> {
    if (isTauriRuntime()) return invokeTauri<MaintenanceHistoryRecord[]>('list_maintenance_history');
    return browserPreviewAdapter.listMaintenanceHistory();
  },

  async upsertMaintenanceTask(input: UpsertMaintenanceTaskInput): Promise<MaintenanceTaskRecord> {
    if (isTauriRuntime()) return invokeTauri<MaintenanceTaskRecord>('upsert_maintenance_task', { input });
    return browserPreviewAdapter.upsertMaintenanceTask(input);
  },

  async completeMaintenanceTask(input: {
    taskId: string;
    completedDate: string;
    cost: number;
    serviceProviderName?: string;
    notes: string;
  }): Promise<MaintenanceTaskRecord> {
    if (isTauriRuntime()) {
      return invokeTauri<MaintenanceTaskRecord>('complete_maintenance_task', { input });
    }
    return browserPreviewAdapter.completeMaintenanceTask(input);
  },

  async deleteMaintenanceTask(taskId: string): Promise<void> {
    if (isTauriRuntime()) return invokeTauri<void>('delete_maintenance_task', { taskId });
    return browserPreviewAdapter.deleteMaintenanceTask(taskId);
  },

  async listDocuments(): Promise<DocumentWithLinks[]> {
    if (isTauriRuntime()) return invokeTauri<DocumentWithLinks[]>('list_documents');
    return browserPreviewAdapter.listDocuments();
  },

  async importDocumentNative(
    category: DocumentCategory,
    linkedAssetIds: string[],
    title?: string
  ): Promise<DocumentWithLinks | null> {
    if (!isTauriRuntime()) return null;
    const sourcePath = await pickNativeFile({
      title: `Import Document into ${APP_BRAND.name}`,
      filters: [
        {
          name: 'Supported Vault Files',
          extensions: [...SUPPORTED_DOCUMENT_EXTENSIONS],
        },
      ],
    });
    if (!sourcePath) return null;
    const doc = await invokeTauri<DocumentWithLinks>('import_document', {
      input: { sourcePath, title, category, linkedAssetIds },
    });
    return doc;
  },

  async importDocumentFromBrowserFile(
    file: File,
    title: string,
    category: DocumentCategory,
    linkedAssetIds: string[]
  ): Promise<DocumentWithLinks> {
    let extractedPages: Array<{ pageNumber: number; content: string }> | undefined;
    if (file.name.toLowerCase().endsWith('.pdf')) {
      try {
        const buf = await file.arrayBuffer();
        const extracted = await extractPdfPages(buf);
        extractedPages = extracted.pages;
      } catch {
        extractedPages = undefined;
      }
    }
    return browserPreviewAdapter.importDocumentBrowser(
      file,
      title,
      category,
      linkedAssetIds,
      extractedPages
    );
  },

  async getDocumentBytes(doc: DocumentWithLinks): Promise<ArrayBuffer | null> {
    if (doc.filePath.startsWith('builtin:')) {
      const bytes = getSeededBoschManualPdfBytes();
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    }
    if (isTauriRuntime()) {
      const byteArr = await invokeTauri<number[]>('read_document_bytes', { documentId: doc.id });
      const u8 = new Uint8Array(byteArr);
      return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
    }
    return getPreviewBlob(doc.id);
  },

  async verifyDocumentsIntegrity(): Promise<IntegrityReport> {
    if (isTauriRuntime()) return invokeTauri<IntegrityReport>('verify_documents_integrity');
    return browserPreviewAdapter.verifyDocumentsIntegrity();
  },

  async acceptModifiedDocument(documentId: string): Promise<DocumentWithLinks> {
    if (isTauriRuntime()) {
      return invokeTauri<DocumentWithLinks>('accept_modified_document', { documentId });
    }
    return browserPreviewAdapter.acceptModifiedDocument(documentId);
  },

  async updateDocumentMetadata(
    documentId: string,
    title: string,
    category: DocumentCategory,
    linkedAssetIds: string[]
  ): Promise<void> {
    if (isTauriRuntime()) {
      return invokeTauri<void>('update_document_metadata', {
        documentId,
        title,
        category,
        linkedAssetIds,
      });
    }
    return browserPreviewAdapter.updateDocumentMetadata(documentId, title, category, linkedAssetIds);
  },

  async deleteDocument(documentId: string): Promise<void> {
    if (isTauriRuntime()) return invokeTauri<void>('delete_document', { documentId });
    return browserPreviewAdapter.deleteDocument(documentId);
  },

  async globalSearch(query: string): Promise<SearchHit[]> {
    if (isTauriRuntime()) return invokeTauri<SearchHit[]>('global_search', { query });
    return browserPreviewAdapter.globalSearch(query);
  },

  async getPropertySpecs(): Promise<PropertySpecsBundle> {
    if (isTauriRuntime()) return invokeTauri<PropertySpecsBundle>('get_property_specs');
    return browserPreviewAdapter.getPropertySpecs();
  },

  async upsertPaintRecord(
    record: Omit<PaintRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<void> {
    if (isTauriRuntime()) return invokeTauri<void>('upsert_paint_record', { input: record });
    return browserPreviewAdapter.upsertPaintRecord(record);
  },

  async deletePaintRecord(id: string): Promise<void> {
    if (isTauriRuntime()) return invokeTauri<void>('delete_paint_record', { id });
    return browserPreviewAdapter.deletePaintRecord(id);
  },

  async upsertElectricalBreaker(
    record: Omit<ElectricalBreaker, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<void> {
    if (isTauriRuntime()) return invokeTauri<void>('upsert_electrical_breaker', { input: record });
    return browserPreviewAdapter.upsertElectricalBreaker(record);
  },

  async deleteElectricalBreaker(id: string): Promise<void> {
    if (isTauriRuntime()) return invokeTauri<void>('delete_electrical_breaker', { id });
    return browserPreviewAdapter.deleteElectricalBreaker(id);
  },

  async upsertNetworkSetting(
    record: Omit<NetworkSetting, 'id' | 'updatedAt'> & { id?: string }
  ): Promise<void> {
    if (isTauriRuntime()) return invokeTauri<void>('upsert_network_setting', { input: record });
    return browserPreviewAdapter.upsertNetworkSetting(record);
  },

  async upsertUtilityRecord(
    record: Omit<UtilityRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<void> {
    if (isTauriRuntime()) return invokeTauri<void>('upsert_utility_record', { input: record });
    return browserPreviewAdapter.upsertUtilityRecord(record);
  },

  async deleteUtilityRecord(id: string): Promise<void> {
    if (isTauriRuntime()) return invokeTauri<void>('delete_utility_record', { id });
    return browserPreviewAdapter.deleteUtilityRecord(id);
  },

  async exportInsurancePackage(request: InsuranceExportRequest): Promise<InsuranceExportResult | null> {
    if (isTauriRuntime()) {
      const dest = await saveNativeFile({
        title: 'Save Encrypted Insurance & Moving Package',
        defaultPath: BACKUP_CONFIG.defaultInsurancePackFilename,
        filters: [{ name: 'Encrypted ZIP Archive', extensions: ['zip'] }],
      });
      if (!dest) return null;
      return invokeTauri<InsuranceExportResult>('export_insurance_package', {
        request: { ...request, destinationPath: dest },
      });
    }
    return browserPreviewAdapter.exportInsurancePackage(request);
  },

  async listBackupHistory(): Promise<BackupHistoryRecord[]> {
    if (isTauriRuntime()) return invokeTauri<BackupHistoryRecord[]>('list_backup_history');
    return browserPreviewAdapter.listBackupHistory();
  },

  async createBackup(): Promise<BackupHistoryRecord | null> {
    if (isTauriRuntime()) {
      const dest = await saveNativeFile({
        title: `Save Full ${APP_BRAND.name} Backup Archive`,
        defaultPath: BACKUP_CONFIG.defaultBackupFilename,
        filters: [
          {
            name: BACKUP_CONFIG.filterName,
            extensions: BACKUP_CONFIG.filterExtensions,
          },
        ],
      });
      if (!dest) return null;
      return invokeTauri<BackupHistoryRecord>('create_backup', { destinationPath: dest });
    }
    return browserPreviewAdapter.createBackup();
  },

  async validateBackupFileBrowser(file: File): Promise<BackupManifest> {
    return browserPreviewAdapter.validateBackupFileBrowser(file);
  },

  async restoreFromBackupBrowser(file: File): Promise<BackupManifest> {
    return browserPreviewAdapter.restoreFromBackupBrowser(file);
  },

  async validateBackupNative(): Promise<{ path: string; manifest: BackupManifest } | null> {
    if (!isTauriRuntime()) return null;
    const path = await pickNativeFile({
      title: `Select ${APP_BRAND.name} Backup Archive`,
      filters: [
        {
          name: BACKUP_CONFIG.filterName,
          extensions: BACKUP_CONFIG.filterExtensions,
        },
      ],
    });
    if (!path) return null;
    const manifest = await invokeTauri<BackupManifest>('validate_backup_file', { archivePath: path });
    return { path, manifest };
  },

  async restoreBackupNative(archivePath: string): Promise<BackupManifest> {
    return invokeTauri<BackupManifest>('restore_from_backup', { archivePath });
  },

  async getSettings(): Promise<AppSettings> {
    if (isTauriRuntime()) {
      const [raw, storageCfg] = await Promise.all([
        invokeTauri<Record<string, string>>('get_settings'),
        invokeTauri<StorageConfig>('get_storage_config').catch(() => null),
      ]);
      let sidebarGroups: AppSettings['sidebarGroups'] | undefined;
      if (raw.sidebarGroups) {
        try {
          sidebarGroups = JSON.parse(raw.sidebarGroups) as AppSettings['sidebarGroups'];
        } catch {
          sidebarGroups = undefined;
        }
      }
      return normalizeSettings({
        theme: normalizeTheme(raw.theme),
        currency: raw.currency,
        warrantyAlertDays: raw.warrantyAlertDays ? Number(raw.warrantyAlertDays) : undefined,
        notificationsEnabled:
          raw.notificationsEnabled !== undefined ? raw.notificationsEnabled !== 'false' : undefined,
        ownerName: raw.ownerName,
        residenceName: raw.residenceName,
        ownerEmail: raw.ownerEmail,
        storagePath: storageCfg?.storagePath ?? raw.storagePath ?? '',
        onboardingCompleted:
          raw.onboardingCompleted !== undefined ? raw.onboardingCompleted === 'true' : undefined,
        sidebarGroups,
      });
    }
    return browserPreviewAdapter.getSettings();
  },

  async updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    if (isTauriRuntime()) {
      for (const [k, v] of Object.entries(partial)) {
        const serialized = k === 'sidebarGroups' ? JSON.stringify(v) : String(v);
        await invokeTauri<void>('set_setting', { key: k, value: serialized });
      }
      return this.getSettings();
    }
    return browserPreviewAdapter.updateSettings(partial);
  },

  async getStorageConfig(): Promise<StorageConfig> {
    if (isTauriRuntime()) return invokeTauri<StorageConfig>('get_storage_config');
    return browserPreviewAdapter.getStorageConfig();
  },

  async chooseAndSetStorageLocation(migrateExisting = true): Promise<StorageConfig | null> {
    if (!isTauriRuntime()) return null;
    const picked = await pickNativeDirectory('Choose Authorized Document Storage Folder');
    if (!picked) return null;
    return invokeTauri<StorageConfig>('set_storage_location', {
      newPath: picked,
      migrateExisting,
    });
  },

  async setStorageLocation(newPath: string, migrateExisting = true): Promise<StorageConfig> {
    if (isTauriRuntime()) {
      return invokeTauri<StorageConfig>('set_storage_location', {
        newPath,
        migrateExisting,
      });
    }
    return browserPreviewAdapter.setStorageLocation(newPath, migrateExisting);
  },

  async loadSampleData(): Promise<boolean> {
    if (isTauriRuntime()) return invokeTauri<boolean>('load_sample_data');
    return browserPreviewAdapter.loadSampleData();
  },

  async resetCleanVault(): Promise<void> {
    if (!isTauriRuntime()) {
      return browserPreviewAdapter.resetCleanVault();
    }
  },
};

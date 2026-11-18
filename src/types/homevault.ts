import {
  APP_PATHS,
  DOCUMENT_CATEGORIES,
  HOUSEHOLD_DEFAULTS,
  THEME_FAMILIES,
  THEME_NAMES,
  WARRANTY_TYPES,
} from '@/src/constants';

export type AppTheme =
  | 'light'
  | 'dark'
  | 'warm-linen'
  | 'nordic-sage'
  | 'midnight-navy'
  | 'warm-espresso';

export interface ThemePalette {
  bg: string;
  sidebar: string;
  card: string;
  subtle: string;
  elevated: string;
  hover: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentHover: string;
  accentFg: string;
  border: string;
  borderStrong: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
}

export interface ThemePreset {
  id: AppTheme;
  name: string;
  family: string;
  mode: 'light' | 'dark';
  description: string;
  palette: ThemePalette;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'light',
    name: THEME_NAMES.light,
    family: THEME_FAMILIES.signature,
    mode: 'light',
    description: 'Neutral cool-stone workspace with crisp white cards and balanced slate ink.',
    palette: {
      bg: '#F5F6F8',
      sidebar: '#ECEEF2',
      card: '#FFFFFF',
      subtle: '#F8F9FB',
      elevated: '#EEF1F6',
      hover: '#E3E7EE',
      textPrimary: '#1B1D21',
      textSecondary: '#525866',
      accent: '#2563EB',
      accentHover: '#1D4ED8',
      accentFg: '#1D4ED8',
      border: '#D9DEE6',
      borderStrong: '#C2C9D6',
      success: '#166534',
      warning: '#92400E',
      danger: '#B91C1C',
      info: '#0369A1',
    },
  },
  {
    id: 'warm-linen',
    name: THEME_NAMES['warm-linen'],
    family: THEME_FAMILIES.warmLinen,
    mode: 'light',
    description: 'Soft alabaster paper surfaces with warm ivory cards and deep botanical teal.',
    palette: {
      bg: '#F5F2EB',
      sidebar: '#EAE4D8',
      card: '#FFFDF9',
      subtle: '#F2EDE3',
      elevated: '#EAE3D5',
      hover: '#DFD7C7',
      textPrimary: '#1F1D19',
      textSecondary: '#57524A',
      accent: '#0F766E',
      accentHover: '#115E59',
      accentFg: '#0D655E',
      border: '#DCD4C6',
      borderStrong: '#C5BBAE',
      success: '#166534',
      warning: '#92400E',
      danger: '#B91C1C',
      info: '#0369A1',
    },
  },
  {
    id: 'nordic-sage',
    name: THEME_NAMES['nordic-sage'],
    family: THEME_FAMILIES.nordicSage,
    mode: 'light',
    description: 'Cool eucalyptus mist workspace with porcelain cards and deep ocean cerulean.',
    palette: {
      bg: '#EDF2F1',
      sidebar: '#E1E9E7',
      card: '#FFFFFF',
      subtle: '#F4F7F6',
      elevated: '#E6EEEC',
      hover: '#D6E2DF',
      textPrimary: '#13201E',
      textSecondary: '#465955',
      accent: '#0E7490',
      accentHover: '#155E75',
      accentFg: '#155E75',
      border: '#CFDAD7',
      borderStrong: '#B5C6C1',
      success: '#166534',
      warning: '#92400E',
      danger: '#B91C1C',
      info: '#0369A1',
    },
  },
  {
    id: 'dark',
    name: THEME_NAMES.dark,
    family: THEME_FAMILIES.signature,
    mode: 'dark',
    description: 'Deep charcoal workspace with graphite surfaces and crisp luminous blue accents.',
    palette: {
      bg: '#111317',
      sidebar: '#16191E',
      card: '#1C2026',
      subtle: '#181C22',
      elevated: '#232830',
      hover: '#2B313B',
      textPrimary: '#F1F3F5',
      textSecondary: '#A6B0BF',
      accent: '#2563EB',
      accentHover: '#1D4ED8',
      accentFg: '#60A5FA',
      border: '#2B313B',
      borderStrong: '#3B4352',
      success: '#4ADE80',
      warning: '#FBBF24',
      danger: '#F87171',
      info: '#38BDF8',
    },
  },
  {
    id: 'midnight-navy',
    name: THEME_NAMES['midnight-navy'],
    family: THEME_FAMILIES.midnightNavy,
    mode: 'dark',
    description: 'Deep indigo-slate workspace with elevated cobalt cards and crisp sky highlights.',
    palette: {
      bg: '#0B111E',
      sidebar: '#101829',
      card: '#162033',
      subtle: '#121B2D',
      elevated: '#1E2B44',
      hover: '#263656',
      textPrimary: '#F1F5FB',
      textSecondary: '#A6B5CC',
      accent: '#2563EB',
      accentHover: '#1D4ED8',
      accentFg: '#7CC4FA',
      border: '#25334C',
      borderStrong: '#364A6D',
      success: '#4ADE80',
      warning: '#FBBF24',
      danger: '#F87171',
      info: '#38BDF8',
    },
  },
  {
    id: 'warm-espresso',
    name: THEME_NAMES['warm-espresso'],
    family: THEME_FAMILIES.warmEspresso,
    mode: 'dark',
    description: 'Low-glare roasted umber & warm carbon surfaces with rich amber accents.',
    palette: {
      bg: '#141210',
      sidebar: '#1B1815',
      card: '#231F1B',
      subtle: '#1E1A17',
      elevated: '#2C2722',
      hover: '#37302A',
      textPrimary: '#F5F1EB',
      textSecondary: '#BCB3A6',
      accent: '#B45309',
      accentHover: '#92400E',
      accentFg: '#FBBF24',
      border: '#342E28',
      borderStrong: '#4A4139',
      success: '#4ADE80',
      warning: '#FBBF24',
      danger: '#F87171',
      info: '#38BDF8',
    },
  },
];

const VALID_THEME_IDS = new Set<AppTheme>(THEME_PRESETS.map((t) => t.id));

export function normalizeTheme(raw?: string | null): AppTheme {
  if (raw === 'signature-light') return 'light';
  if (raw === 'signature-dark') return 'dark';
  if (raw && VALID_THEME_IDS.has(raw as AppTheme)) {
    return raw as AppTheme;
  }
  return 'light';
}

export function getThemePreset(theme: AppTheme): ThemePreset {
  return THEME_PRESETS.find((t) => t.id === theme) ?? THEME_PRESETS[0];
}

export function isDarkTheme(theme: AppTheme): boolean {
  return getThemePreset(theme).mode === 'dark';
}

export function getToggledTheme(theme: AppTheme): AppTheme {
  switch (theme) {
    case 'light':
      return 'dark';
    case 'dark':
      return 'light';
    case 'warm-linen':
      return 'warm-espresso';
    case 'warm-espresso':
      return 'warm-linen';
    case 'nordic-sage':
      return 'midnight-navy';
    case 'midnight-navy':
      return 'nordic-sage';
  }
}

export type NavSection =
  | 'assets'
  | 'property'
  | 'vault'
  | 'warranties'
  | 'maintenance'
  | 'settings'
  | 'backups'
  | 'about'
  | 'profile';

export type SmartViewType =
  | 'all'
  | 'expiring'
  | 'maintenance_due'
  | 'in_repair'
  | 'recent';

export interface Category {
  id: string;
  name: string;
  icon?: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface Location {
  id: string;
  name: string;
  groupName: string;
  sortOrder: number;
  createdAt: string;
}

export type AssetStatus = 'active' | 'in_repair' | 'retired';

export interface AssetRecord {
  id: string;
  name: string;
  categoryId?: string | null;
  categoryName: string;
  locationId?: string | null;
  locationName: string;
  brand: string;
  model: string;
  description: string;
  serialNumber: string;
  productId: string;
  imei: string;
  qrBarcode: string;
  status: AssetStatus;
  photoPath?: string | null;
  serialPhotoPath?: string | null;
  isFeatured: boolean;
  purchaseDate: string;
  purchasePrice: number;
  currency: string;
  retailer: string;
  invoiceNumber: string;
  paymentMethod: string;
  purchaseNotes: string;
  totalCostOfOwnership: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertAssetInput {
  id?: string;
  name: string;
  categoryName: string;
  locationName: string;
  brand: string;
  model: string;
  description: string;
  serialNumber: string;
  productId: string;
  imei: string;
  qrBarcode: string;
  status: AssetStatus;
  photoPath?: string | null;
  serialPhotoPath?: string | null;
  purchaseDate: string;
  purchasePrice: number;
  currency: string;
  retailer: string;
  invoiceNumber: string;
  paymentMethod: string;
  purchaseNotes: string;
  warrantyProvider?: string;
  warrantyStartDate?: string;
  warrantyExpiryDate?: string;
  warrantyDurationMonths?: number;
  warrantyType?: WarrantyType;
  warrantyExtendedDetails?: string;
  maintenanceRequired?: boolean;
  maintenanceTaskName?: string;
  maintenanceFrequencyDays?: number;
  maintenanceLastServiceDate?: string;
  maintenanceNextServiceDate?: string;
  maintenanceServiceProvider?: string;
  maintenanceSparePartNumber?: string;
  maintenanceInstructions?: string;
}

export type WarrantyType = (typeof WARRANTY_TYPES)[number];

export interface WarrantyRecord {
  id: string;
  assetId: string;
  provider: string;
  startDate: string;
  expiryDate: string;
  durationMonths: number;
  warrantyType: WarrantyType;
  extendedDetails: string;
  certificateDocumentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertWarrantyInput {
  id?: string;
  assetId: string;
  provider: string;
  startDate: string;
  expiryDate: string;
  durationMonths: number;
  warrantyType: WarrantyType;
  extendedDetails: string;
  certificateDocumentId?: string | null;
}

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface MaintenanceTaskRecord {
  id: string;
  assetId: string;
  taskName: string;
  maintenanceRequired: boolean;
  frequencyDays: number;
  lastServiceDate?: string | null;
  nextServiceDate: string;
  priority: TaskPriority;
  serviceProviderId?: string | null;
  serviceProviderName: string;
  sparePartNumber: string;
  estimatedCost: number;
  instructions: string;
  notes: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceHistoryRecord {
  id: string;
  taskId?: string | null;
  assetId: string;
  taskName: string;
  completedDate: string;
  serviceProviderName: string;
  cost: number;
  notes: string;
  createdAt: string;
}

export interface UpsertMaintenanceTaskInput {
  id?: string;
  assetId: string;
  taskName: string;
  maintenanceRequired: boolean;
  frequencyDays: number;
  lastServiceDate?: string | null;
  nextServiceDate: string;
  priority: TaskPriority;
  serviceProviderName: string;
  sparePartNumber: string;
  estimatedCost: number;
  instructions: string;
  notes: string;
}

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export type IntegrityStatus = 'verified' | 'modified' | 'missing' | 'builtin';

export interface DocumentWithLinks {
  id: string;
  title: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  extension: string;
  fileSizeBytes: number;
  category: DocumentCategory;
  sha256Hash: string;
  pageCount: number;
  isMissing: boolean;
  relativePath: string;
  fileModifiedAt: string;
  integrityStatus: IntegrityStatus;
  observedSha256: string;
  lastVerifiedAt: string;
  createdAt: string;
  updatedAt: string;
  linkedAssetIds: string[];
  /** Browser preview only: data URL or indexeddb key */
  previewUrl?: string;
}

export interface StorageConfig {
  storagePath: string;
  defaultStoragePath: string;
  isCustom: boolean;
}

export interface IntegrityReport {
  totalChecked: number;
  verifiedCount: number;
  modifiedCount: number;
  missingCount: number;
  checkedAt: string;
}

export function buildStructuredRelativePath(
  category: DocumentCategory | string,
  fileName: string,
  shortId: string,
  year = new Date().getFullYear()
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._\- ]/g, '_');
  const folder = category || 'Other';
  return `${APP_PATHS.documentsRootFolder}/${folder}/${year}/${shortId.slice(0, 8)}_${safeName}`;
}

export interface DocumentPageIndex {
  documentId: string;
  pageNumber: number;
  content: string;
}

export interface SearchHit {
  kind: 'asset' | 'document' | 'manual_page';
  id: string;
  title: string;
  subtitle: string;
  snippet: string;
  assetId?: string | null;
  documentId?: string | null;
  pageNumber?: number | null;
}

export interface PaintRecord {
  id: string;
  roomName: string;
  brand: string;
  colorName: string;
  hexCode: string;
  finish: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ElectricalBreaker {
  id: string;
  breakerNumber: string;
  circuitLabel: string;
  amperage: string;
  zone: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface NetworkSetting {
  id: string;
  routerName: string;
  model: string;
  ssid: string;
  encryptedPassword: string;
  ipAddress: string;
  notes: string;
  updatedAt: string;
}

export interface UtilityRecord {
  id: string;
  serviceType: string;
  providerName: string;
  accountNumber: string;
  supportContact: string;
  vendorPhone: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PropertySpecsBundle {
  paintRecords: PaintRecord[];
  breakers: ElectricalBreaker[];
  network: NetworkSetting[];
  utilities: UtilityRecord[];
}

export interface InsuranceExportRequest {
  destinationPath?: string;
  roomFilter?: string | null;
  includeReceipts: boolean;
  includeSerialPhotos: boolean;
  includeWarranties: boolean;
  includeManuals: boolean;
  includeMaintenanceHistory: boolean;
  includeValuationPdf: boolean;
  password: string;
}

export interface InsuranceExportResult {
  archivePath: string;
  assetCount: number;
  totalValuation: number;
  fileSizeBytes: number;
  encrypted: boolean;
}

export interface BackupHistoryRecord {
  id: string;
  archiveName: string;
  archivePath: string;
  sizeBytes: number;
  assetCount: number;
  documentCount: number;
  sha256Checksum: string;
  backupType: string;
  createdAt: string;
}

export interface BackupManifest {
  appVersion: string;
  createdAt: string;
  assetCount: number;
  documentCount: number;
  dbSha256: string;
}

export interface SidebarGroupsConfig {
  smartViews: boolean;
  propertyOperations: boolean;
  mainSpaces: boolean;
  otherCategories: boolean;
}

export interface AppSettings {
  theme: AppTheme;
  currency: string;
  warrantyAlertDays: number;
  notificationsEnabled: boolean;
  ownerName: string;
  residenceName: string;
  ownerEmail: string;
  storagePath: string;
  onboardingCompleted: boolean;
  sidebarGroups: SidebarGroupsConfig;
}

export const DEFAULT_SIDEBAR_GROUPS: SidebarGroupsConfig = {
  smartViews: true,
  propertyOperations: true,
  mainSpaces: true,
  otherCategories: true,
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: HOUSEHOLD_DEFAULTS.theme,
  currency: HOUSEHOLD_DEFAULTS.currency,
  warrantyAlertDays: HOUSEHOLD_DEFAULTS.warrantyAlertDays,
  notificationsEnabled: true,
  ownerName: HOUSEHOLD_DEFAULTS.ownerName,
  residenceName: HOUSEHOLD_DEFAULTS.residenceName,
  ownerEmail: '',
  storagePath: '',
  onboardingCompleted: false,
  sidebarGroups: DEFAULT_SIDEBAR_GROUPS,
};

export function normalizeSettings(raw?: Partial<AppSettings>): AppSettings {
  const days = Number(raw?.warrantyAlertDays);
  return {
    theme: normalizeTheme(raw?.theme),
    currency: raw?.currency || DEFAULT_SETTINGS.currency,
    warrantyAlertDays:
      Number.isFinite(days) &&
      days >= HOUSEHOLD_DEFAULTS.minWarrantyAlertDays &&
      days <= HOUSEHOLD_DEFAULTS.maxWarrantyAlertDays
        ? Math.round(days)
        : DEFAULT_SETTINGS.warrantyAlertDays,
    notificationsEnabled: raw?.notificationsEnabled ?? DEFAULT_SETTINGS.notificationsEnabled,
    ownerName: raw?.ownerName?.trim() || DEFAULT_SETTINGS.ownerName,
    residenceName: raw?.residenceName?.trim() || DEFAULT_SETTINGS.residenceName,
    ownerEmail: raw?.ownerEmail !== undefined ? raw.ownerEmail : DEFAULT_SETTINGS.ownerEmail,
    storagePath: typeof raw?.storagePath === 'string' ? raw.storagePath.trim() : '',
    onboardingCompleted: raw?.onboardingCompleted ?? DEFAULT_SETTINGS.onboardingCompleted,
    sidebarGroups: {
      smartViews: raw?.sidebarGroups?.smartViews ?? DEFAULT_SIDEBAR_GROUPS.smartViews,
      propertyOperations:
        raw?.sidebarGroups?.propertyOperations ?? DEFAULT_SIDEBAR_GROUPS.propertyOperations,
      mainSpaces: raw?.sidebarGroups?.mainSpaces ?? DEFAULT_SIDEBAR_GROUPS.mainSpaces,
      otherCategories:
        raw?.sidebarGroups?.otherCategories ?? DEFAULT_SIDEBAR_GROUPS.otherCategories,
    },
  };
}

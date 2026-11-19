export const APP_BRAND = {
  name: 'ItemCare',
  tagline: 'Personal Home & Asset Command Center',
  description:
    'Your Personal Home & Asset Command Center — keep household appliances, warranties, maintenance schedules, property specs, and important documents organized in one place.',
  version: '1.0.0',
  creator: 'Arnab Saha',
  modeLabel: 'Offline-First (Saved on your device)',
  supportedOs: 'Windows 10 & Windows 11',
  appIdentifier: 'com.itemcare.desktop',
  copyright: 'Copyright (c) 2026 ItemCare',
  sampleWifiSsid: 'ItemCare_5G_Mesh',
} as const;

export const APP_PATHS = {
  desktopIconSvg: 'src-tauri/icons/icon.svg',
  desktopIconsDir: 'src-tauri/icons',
  assetsImagesBase: '/src/assets/images',
  defaultSavePath: 'D:\\ItemCare\\VaultFiles',
  defaultVaultFolderExample: 'D:\\ItemCare',
  documentsRootFolder: 'Documents',
  backupsFolder: 'Backups',
  attachmentsFolder: 'attachments',
  sampleRootFolder: 'Sample',
} as const;

export const SAMPLE_ASSET_IMAGES = {
  oledTv: `${APP_PATHS.assetsImagesBase}/asset_oled_tv_1794990119635.jpg`,
  frontWasher: `${APP_PATHS.assetsImagesBase}/asset_front_washer_1794990120962.jpg`,
  splitAc: `${APP_PATHS.assetsImagesBase}/asset_split_ac_1794990120906.jpg`,
  espressoMachine: `${APP_PATHS.assetsImagesBase}/asset_espresso_machine_1794990121471.jpg`,
  macbookPro: `${APP_PATHS.assetsImagesBase}/asset_macbook_pro_1794990121787.jpg`,
  ancHeadphones: `${APP_PATHS.assetsImagesBase}/asset_anc_headphones_1794990121284.jpg`,
} as const;

export const THEME_FAMILY_SIGNATURE = 'ItemCare Signature' as const;

export const THEME_NAMES = {
  light: THEME_FAMILY_SIGNATURE,
  'warm-linen': 'Warm Linen',
  'nordic-sage': 'Nordic Sage',
  dark: THEME_FAMILY_SIGNATURE,
  'midnight-navy': 'Midnight Navy',
  'warm-espresso': 'Warm Espresso',
} as const;

export const THEME_FAMILIES = {
  signature: THEME_FAMILY_SIGNATURE,
  warmLinen: 'Daylight Editorial',
  nordicSage: 'Daylight Mineral',
  midnightNavy: 'Nocturne Slate',
  warmEspresso: 'Nocturne Carbon',
} as const;

export const HOUSEHOLD_DEFAULTS = {
  theme: 'light',
  currency: 'INR',
  warrantyAlertDays: 30,
  minWarrantyAlertDays: 7,
  maxWarrantyAlertDays: 180,
  ownerName: 'Homeowner',
  residenceName: 'Main Residence',
  defaultRoomName: 'Living Room',
  otherCategoriesGroup: 'Other Categories',
} as const;

export const DOCUMENT_CATEGORIES = [
  'Invoices',
  'Warranty Certificates',
  'User Manuals',
  'Serial Photos',
  'Service Receipts',
  'Insurance Documents',
  'Property Documents',
  'Other',
] as const;

export const WARRANTY_TYPES = [
  'Manufacturer',
  'Extended Care',
  'AppleCare+',
  'Retailer Plan',
] as const;

export const SUPPORTED_DOCUMENT_EXTENSIONS = [
  'pdf',
  'jpg',
  'jpeg',
  'png',
  'docx',
  'xlsx',
  'txt',
] as const;

export const SUPPORTED_DOCUMENT_ACCEPT = SUPPORTED_DOCUMENT_EXTENSIONS.map(
  (ext) => `.${ext}`
).join(',');

export const BACKUP_CONFIG = {
  extension: 'hvbackup',
  accept: '.hvbackup,.zip',
  filterName: `${APP_BRAND.name} Backup`,
  filterExtensions: ['hvbackup', 'zip'] as string[],
  defaultBackupFilename: `${APP_BRAND.name}_Backup.hvbackup`,
  defaultInsurancePackFilename: `${APP_BRAND.name}_Insurance_Pack.zip`,
  valuationReportFilename: `${APP_BRAND.name}_Valuation_Report.pdf`,
  previewDbEntryName: 'itemcare_preview_db.json',
  nativeDbFilename: 'itemcare.db',
} as const;

export const STORAGE_KEYS = {
  previewDb: 'itemcare_browser_preview_db_v2',
  previewIndexedDb: 'ItemCarePreviewFiles',
  previewPreRestoreSnapshot: 'itemcare_pre_restore_snapshot',
} as const;
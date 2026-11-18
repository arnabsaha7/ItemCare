import JSZip from 'jszip';
import type {
  AppSettings,
  AssetRecord,
  BackupHistoryRecord,
  BackupManifest,
  Category,
  DocumentPageIndex,
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
  APP_PATHS,
  BACKUP_CONFIG,
  HOUSEHOLD_DEFAULTS,
  SAMPLE_ASSET_IMAGES,
  STORAGE_KEYS,
  SUPPORTED_DOCUMENT_EXTENSIONS,
} from '@/src/constants';
import {
  buildStructuredRelativePath,
  DEFAULT_SETTINGS,
  normalizeSettings,
} from '@/src/types/homevault';
import { addDaysIso, todayIsoDate } from '@/src/utils/format';
import {
  buildValuationReportPdfBytes,
  getSeededBoschManualPdfBytes,
} from '@/src/utils/pdfEngine';

const STORAGE_KEY = STORAGE_KEYS.previewDb;
const LEGACY_STORAGE_KEY = STORAGE_KEYS.legacyPreviewDb;
const DEFAULT_PREVIEW_STORAGE_PATH = APP_PATHS.defaultSavePath;
const IDB_NAME = STORAGE_KEYS.previewIndexedDb;
const IDB_STORE = 'blobs';

interface PreviewDatabase {
  categories: Category[];
  locations: Location[];
  assets: AssetRecord[];
  warranties: WarrantyRecord[];
  maintenanceTasks: MaintenanceTaskRecord[];
  maintenanceHistory: MaintenanceHistoryRecord[];
  documents: DocumentWithLinks[];
  documentPages: DocumentPageIndex[];
  paintRecords: PaintRecord[];
  breakers: ElectricalBreaker[];
  network: NetworkSetting[];
  utilities: UtilityRecord[];
  backups: BackupHistoryRecord[];
  settings: AppSettings;
}

function uuid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function openBlobDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putPreviewBlob(id: string, buffer: ArrayBuffer): Promise<void> {
  const db = await openBlobDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(buffer, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPreviewBlob(id: string): Promise<ArrayBuffer | null> {
  if (id === 'builtin:bosch_serie6_manual.pdf') {
    const bytes = getSeededBoschManualPdfBytes();
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  }
  const db = await openBlobDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(id);
    req.onsuccess = () => resolve((req.result as ArrayBuffer | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deletePreviewBlob(id: string): Promise<void> {
  const db = await openBlobDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buf as BufferSource);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function triggerBrowserDownload(bytes: Uint8Array, filename: string, mimeType: string): void {
  const blob = new Blob([bytes as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function createLookupSeed(): { categories: Category[]; locations: Location[] } {
  const nowIso = new Date().toISOString();
  const categories: Category[] = [
    { id: uuid(), name: 'Entertainment & AV', icon: 'tv', sortOrder: 1, createdAt: nowIso },
    { id: uuid(), name: 'Major Appliances', icon: 'washing-machine', sortOrder: 2, createdAt: nowIso },
    { id: uuid(), name: 'Climate & HVAC', icon: 'wind', sortOrder: 3, createdAt: nowIso },
    { id: uuid(), name: 'Kitchen Appliances', icon: 'coffee', sortOrder: 4, createdAt: nowIso },
    { id: uuid(), name: 'Computing & Mobile', icon: 'laptop', sortOrder: 5, createdAt: nowIso },
    { id: uuid(), name: 'Audio & Wearables', icon: 'headphones', sortOrder: 6, createdAt: nowIso },
    { id: uuid(), name: 'Furniture & Decor', icon: 'sofa', sortOrder: 7, createdAt: nowIso },
    { id: uuid(), name: 'Vehicles & Mobility', icon: 'car', sortOrder: 8, createdAt: nowIso },
    { id: uuid(), name: 'Tools & Utilities', icon: 'wrench', sortOrder: 9, createdAt: nowIso },
  ];

  const locations: Location[] = [
    { id: uuid(), name: 'Living Room', groupName: HOUSEHOLD_DEFAULTS.residenceName, sortOrder: 1, createdAt: nowIso },
    { id: uuid(), name: 'Kitchen', groupName: HOUSEHOLD_DEFAULTS.residenceName, sortOrder: 2, createdAt: nowIso },
    { id: uuid(), name: 'Master Bedroom', groupName: HOUSEHOLD_DEFAULTS.residenceName, sortOrder: 3, createdAt: nowIso },
    { id: uuid(), name: 'Utility & Garage', groupName: HOUSEHOLD_DEFAULTS.residenceName, sortOrder: 4, createdAt: nowIso },
    { id: uuid(), name: 'Vehicles', groupName: HOUSEHOLD_DEFAULTS.otherCategoriesGroup, sortOrder: 5, createdAt: nowIso },
    { id: uuid(), name: 'Everyday Carry', groupName: HOUSEHOLD_DEFAULTS.otherCategoriesGroup, sortOrder: 6, createdAt: nowIso },
  ];

  return { categories, locations };
}

function createCleanSeed(): PreviewDatabase {
  const { categories, locations } = createLookupSeed();
  return {
    categories,
    locations,
    assets: [],
    warranties: [],
    maintenanceTasks: [],
    maintenanceHistory: [],
    documents: [],
    documentPages: [],
    paintRecords: [],
    breakers: [],
    network: [],
    utilities: [],
    backups: [],
    settings: {
      ...DEFAULT_SETTINGS,
      storagePath: DEFAULT_PREVIEW_STORAGE_PATH,
      onboardingCompleted: false,
      sidebarGroups: { ...DEFAULT_SETTINGS.sidebarGroups },
    },
  };
}

function buildSampleSeedData(categories: Category[], locations: Location[]): Omit<PreviewDatabase, 'categories' | 'locations' | 'backups' | 'settings'> {
  const now = new Date();
  const nowIso = now.toISOString();
  const today = todayIsoDate();

  const catId = (name: string) => categories.find((c) => c.name === name)?.id ?? null;
  const locId = (name: string) => locations.find((l) => l.name === name)?.id ?? null;

  const seedDefs = [
    {
      name: 'LG C3 65" OLED Evo TV',
      category: 'Entertainment & AV',
      location: 'Living Room',
      brand: 'LG',
      model: 'OLED65C3PSA',
      serial: 'LG409IN65C3882',
      productId: 'OLED65C3-IN',
      purchaseDate: '2024-06-15',
      price: 164990,
      retailer: 'Reliance Digital',
      invoice: 'RD-2024-99412',
      featured: true,
      photoPath: SAMPLE_ASSET_IMAGES.oledTv,
      warrantyProvider: 'LG India Care',
      warrantyType: 'Extended Care' as const,
      warrantyDays: 412,
      warrantyMonths: 36,
    },
    {
      name: 'Bosch Serie 6 Front-Load Washer',
      category: 'Major Appliances',
      location: 'Utility & Garage',
      brand: 'Bosch',
      model: 'WAJ2846IN',
      serial: 'BSH88204199A',
      productId: 'SER6-9KG-IN',
      purchaseDate: '2024-12-06',
      price: 48500,
      retailer: 'Bosch Brand Store',
      invoice: 'BSH-IN-44810',
      featured: true,
      photoPath: SAMPLE_ASSET_IMAGES.frontWasher,
      warrantyProvider: 'Bosch Home Appliances',
      warrantyType: 'Manufacturer' as const,
      warrantyDays: 18,
      warrantyMonths: 24,
    },
    {
      name: 'Daikin 1.5 Ton Inverter Split AC',
      category: 'Climate & HVAC',
      location: 'Master Bedroom',
      brand: 'Daikin',
      model: 'FTKM50U',
      serial: 'DK992841004X',
      productId: 'DKN-FTKM50U',
      purchaseDate: '2024-03-14',
      price: 44200,
      retailer: 'Croma Electronics',
      invoice: 'CRM-MUM-81204',
      featured: true,
      photoPath: SAMPLE_ASSET_IMAGES.splitAc,
      warrantyProvider: 'Daikin Airconditioning India',
      warrantyType: 'Manufacturer' as const,
      warrantyDays: 320,
      warrantyMonths: 60,
    },
    {
      name: 'Breville Barista Express',
      category: 'Kitchen Appliances',
      location: 'Kitchen',
      brand: 'Breville',
      model: 'BES870XL',
      serial: 'BRV77301928K',
      productId: 'BES870-BSS',
      purchaseDate: '2025-01-20',
      price: 62000,
      retailer: "Something's Brewing",
      invoice: 'SB-2025-1189',
      featured: true,
      photoPath: SAMPLE_ASSET_IMAGES.espressoMachine,
      warrantyProvider: 'Breville Care Plus',
      warrantyType: 'Extended Care' as const,
      warrantyDays: 730,
      warrantyMonths: 36,
    },
    {
      name: 'Apple MacBook Pro 16" M3',
      category: 'Computing & Mobile',
      location: 'Everyday Carry',
      brand: 'Apple',
      model: 'MRW13HN/A',
      serial: 'C02ZN492MD6R',
      productId: 'MBP16-M3PRO',
      purchaseDate: '2024-09-02',
      price: 249900,
      retailer: 'Apple BKC Mumbai',
      invoice: 'APL-IN-551920',
      featured: true,
      photoPath: SAMPLE_ASSET_IMAGES.macbookPro,
      warrantyProvider: 'AppleCare+',
      warrantyType: 'AppleCare+' as const,
      warrantyDays: 540,
      warrantyMonths: 36,
    },
    {
      name: 'Sony WH-1000XM5 Headphones',
      category: 'Audio & Wearables',
      location: 'Everyday Carry',
      brand: 'Sony',
      model: 'WH1000XM5/S',
      serial: 'SNY50928174X',
      productId: 'WH1000XM5-SLV',
      purchaseDate: '2024-02-11',
      price: 26990,
      retailer: 'Amazon India',
      invoice: 'AMZ-IN-774920',
      featured: true,
      photoPath: SAMPLE_ASSET_IMAGES.ancHeadphones,
      warrantyProvider: 'Sony India',
      warrantyType: 'Manufacturer' as const,
      warrantyDays: -95,
      warrantyMonths: 12,
    },
    // Additional 18 household items -> Total 24 assets, INR 14,85,000
    { name: 'Sonos Arc Soundbar + Sub Gen 3', category: 'Entertainment & AV', location: 'Living Room', brand: 'Sonos', model: 'ARCG1IN1BLK', serial: 'SNS99281044B', productId: 'ARC-SUB-SET', purchaseDate: '2024-07-04', price: 112000, retailer: 'Audio Concept', invoice: 'AC-2024-301', featured: false, photoPath: null, warrantyProvider: 'Sonos India', warrantyType: 'Manufacturer' as const, warrantyDays: 320, warrantyMonths: 24 },
    { name: 'Natuzzi Editions Leather Sectional', category: 'Furniture & Decor', location: 'Living Room', brand: 'Natuzzi', model: 'B984-C02', serial: 'NTZ3382019', productId: 'NTZ-SEC-GRY', purchaseDate: '2023-11-18', price: 105000, retailer: 'Natuzzi Flagship', invoice: 'NTZ-23-198', featured: false, photoPath: null, warrantyProvider: 'Natuzzi Structural', warrantyType: 'Manufacturer' as const, warrantyDays: 540, warrantyMonths: 60 },
    { name: 'Dyson Purifier Cool Formaldehyde', category: 'Climate & HVAC', location: 'Living Room', brand: 'Dyson', model: 'TP09', serial: 'DYS88109234T', productId: 'DYS-TP09-WHT', purchaseDate: '2024-11-28', price: 49900, retailer: 'Dyson Demo Store', invoice: 'DYS-91042', featured: false, photoPath: null, warrantyProvider: 'Dyson India', warrantyType: 'Manufacturer' as const, warrantyDays: 24, warrantyMonths: 24 },
    { name: 'Apple TV 4K (3rd Gen Ethernet)', category: 'Entertainment & AV', location: 'Living Room', brand: 'Apple', model: 'MN893HN/A', serial: 'F7P991028KL', productId: 'ATV4K-128G', purchaseDate: '2024-06-15', price: 16900, retailer: 'Imagine Store', invoice: 'IMG-44821', featured: false, photoPath: null, warrantyProvider: 'Apple India', warrantyType: 'Manufacturer' as const, warrantyDays: -95, warrantyMonths: 12 },
    { name: 'Custom Walnut Media Console', category: 'Furniture & Decor', location: 'Living Room', brand: 'Stanley Level Next', model: 'SLN-WLT-210', serial: 'SLN-2024-089', productId: 'SLN-MED-210', purchaseDate: '2024-01-12', price: 38500, retailer: 'Stanley Boutique', invoice: 'SLN-1129', featured: false, photoPath: null, warrantyProvider: 'Stanley Care', warrantyType: 'Manufacturer' as const, warrantyDays: 320, warrantyMonths: 36 },
    { name: 'Samsung Bespoke French Door Fridge', category: 'Major Appliances', location: 'Kitchen', brand: 'Samsung', model: 'RF65A967FSG', serial: 'SAM77201948K', productId: 'RF65-BESPOKE', purchaseDate: '2024-04-20', price: 98000, retailer: 'Samsung SmartPlaza', invoice: 'SAM-88321', featured: false, photoPath: null, warrantyProvider: 'Samsung India', warrantyType: 'Extended Care' as const, warrantyDays: 730, warrantyMonths: 48 },
    { name: 'Bosch Serie 6 Built-in Dishwasher', category: 'Major Appliances', location: 'Kitchen', brand: 'Bosch', model: 'SMS66GI01I', serial: 'BSH55102938D', productId: 'SMS66-DW', purchaseDate: '2024-05-09', price: 46500, retailer: 'Croma Electronics', invoice: 'CRM-88401', featured: false, photoPath: null, warrantyProvider: 'Bosch India', warrantyType: 'Manufacturer' as const, warrantyDays: 320, warrantyMonths: 24 },
    { name: 'AO Smith ProPlanet P6 Water Purifier', category: 'Kitchen Appliances', location: 'Kitchen', brand: 'AO Smith', model: 'P6-RO-UV', serial: 'AOS99182736R', productId: 'AOS-P6-RO', purchaseDate: '2024-08-19', price: 21500, retailer: 'AO Smith Direct', invoice: 'AOS-2024-552', featured: false, photoPath: null, warrantyProvider: 'AO Smith AMC', warrantyType: 'Extended Care' as const, warrantyDays: 320, warrantyMonths: 24 },
    { name: 'Faber 90cm Autoclean Chimney', category: 'Kitchen Appliances', location: 'Kitchen', brand: 'Faber', model: 'HOOD-CREST-90', serial: 'FBR44920183', productId: 'FBR-CREST90', purchaseDate: '2023-12-14', price: 24800, retailer: 'Faber Platinum', invoice: 'FBR-33019', featured: false, photoPath: null, warrantyProvider: 'Faber India', warrantyType: 'Manufacturer' as const, warrantyDays: 540, warrantyMonths: 60 },
    { name: 'KitchenAid Artisan Stand Mixer', category: 'Kitchen Appliances', location: 'Kitchen', brand: 'KitchenAid', model: '5KSM150PS', serial: 'KTA11029384', productId: 'KSM150-EMP', purchaseDate: '2024-09-25', price: 42900, retailer: 'ThinKitchen', invoice: 'TK-99201', featured: false, photoPath: null, warrantyProvider: 'KitchenAid India', warrantyType: 'Manufacturer' as const, warrantyDays: 540, warrantyMonths: 60 },
    { name: 'Panasonic 32L Convection Microwave', category: 'Kitchen Appliances', location: 'Kitchen', brand: 'Panasonic', model: 'NN-CT645BFDG', serial: 'PAN88291034', productId: 'NNCT645-BLK', purchaseDate: '2024-03-01', price: 16400, retailer: 'Vijay Sales', invoice: 'VS-77312', featured: false, photoPath: null, warrantyProvider: 'Panasonic India', warrantyType: 'Manufacturer' as const, warrantyDays: -95, warrantyMonths: 12 },
    { name: 'Elica 4-Burner Built-in Glass Hob', category: 'Kitchen Appliances', location: 'Kitchen', brand: 'Elica', model: 'FB-MFC-4B-70', serial: 'ELC99283710', productId: 'ELC-HOB70', purchaseDate: '2023-12-14', price: 19200, retailer: 'Faber Platinum', invoice: 'FBR-33020', featured: false, photoPath: null, warrantyProvider: 'Elica Care', warrantyType: 'Manufacturer' as const, warrantyDays: 320, warrantyMonths: 24 },
    { name: 'Wakefit Ortho Plus King Mattress', category: 'Furniture & Decor', location: 'Master Bedroom', brand: 'Wakefit', model: 'WF-ORTHO-7872', serial: 'WKF22019485', productId: 'WF-KING-8IN', purchaseDate: '2024-01-05', price: 22990, retailer: 'Wakefit Experience', invoice: 'WF-441092', featured: false, photoPath: null, warrantyProvider: 'Wakefit 10-Yr', warrantyType: 'Manufacturer' as const, warrantyDays: 730, warrantyMonths: 120 },
    { name: 'Philips Hue Gradient Bedroom Kit', category: 'Entertainment & AV', location: 'Master Bedroom', brand: 'Philips Hue', model: '9290024687', serial: 'PHL88392011', productId: 'HUE-GRAD-KIT', purchaseDate: '2024-10-12', price: 18500, retailer: 'Amazon India', invoice: 'AMZ-IN-883201', featured: false, photoPath: null, warrantyProvider: 'Signify India', warrantyType: 'Manufacturer' as const, warrantyDays: 320, warrantyMonths: 24 },
    { name: 'Teakwood Platform Bed & Sideboards', category: 'Furniture & Decor', location: 'Master Bedroom', brand: 'Urban Ladder', model: 'UL-TEAK-K01', serial: 'UL-992018-M', productId: 'UL-KING-TK', purchaseDate: '2023-11-22', price: 68500, retailer: 'Urban Ladder Studio', invoice: 'UL-77410', featured: false, photoPath: null, warrantyProvider: 'Urban Ladder', warrantyType: 'Manufacturer' as const, warrantyDays: 540, warrantyMonths: 36 },
    { name: 'Luminous 1500VA Home Sine-Wave UPS', category: 'Tools & Utilities', location: 'Utility & Garage', brand: 'Luminous', model: 'Zelio+ 1700', serial: 'LUM88291044', productId: 'ZELIO-1700', purchaseDate: '2024-04-02', price: 18400, retailer: 'Exide Care Hub', invoice: 'EXC-2024-119', featured: false, photoPath: null, warrantyProvider: 'Luminous Power', warrantyType: 'Manufacturer' as const, warrantyDays: 320, warrantyMonths: 24 },
    { name: 'Bosch EasyAquatak 120 Pressure Washer', category: 'Tools & Utilities', location: 'Utility & Garage', brand: 'Bosch', model: '06008A79F0', serial: 'BSH-PT-99102', productId: 'AQT-120', purchaseDate: '2024-07-18', price: 9930, retailer: 'Amazon India', invoice: 'AMZ-IN-661209', featured: false, photoPath: null, warrantyProvider: 'Bosch Power Tools', warrantyType: 'Manufacturer' as const, warrantyDays: 320, warrantyMonths: 12 },
    { name: 'Ather 450X Electric Scooter (3.7 kWh)', category: 'Vehicles & Mobility', location: 'Vehicles', brand: 'Ather Energy', model: '450X-GEN3', serial: 'MYH450X2024IN8891', productId: 'ATH-450X-37', purchaseDate: '2024-05-24', price: 158500, retailer: 'Ather Space Indiranagar', invoice: 'ATH-BLR-90412', featured: false, photoPath: null, warrantyProvider: 'Ather Battery Protect', warrantyType: 'Extended Care' as const, warrantyDays: 730, warrantyMonths: 60 },
  ];

  const assets: AssetRecord[] = [];
  const warranties: WarrantyRecord[] = [];

  let daikinId = '';
  let boschWasherId = '';
  let brevilleId = '';

  seedDefs.forEach((s, idx) => {
    const id = uuid();
    if (s.name.includes('Daikin')) daikinId = id;
    if (s.name.includes('Bosch Serie 6 Front-Load')) boschWasherId = id;
    if (s.name.includes('Breville')) brevilleId = id;

    const createdAt = addDaysIso(today, -(25 - idx)) + 'T09:00:00.000Z';
    const isDaikin = s.name.includes('Daikin');

    assets.push({
      id,
      name: s.name,
      categoryId: catId(s.category),
      categoryName: s.category,
      locationId: locId(s.location),
      locationName: s.location,
      brand: s.brand,
      model: s.model,
      description: `${s.brand} ${s.model} registered in ${s.location}`,
      serialNumber: s.serial,
      productId: s.productId,
      imei: '',
      qrBarcode: `HV-${s.serial}`,
      status: 'active',
      photoPath: s.photoPath,
      serialPhotoPath: null,
      isFeatured: s.featured,
      purchaseDate: s.purchaseDate,
      purchasePrice: s.price,
      currency: 'INR',
      retailer: s.retailer,
      invoiceNumber: s.invoice,
      paymentMethod: 'HDFC Regalia Credit Card',
      purchaseNotes: '',
      totalCostOfOwnership: isDaikin ? s.price + 2400 : s.price,
      createdAt,
      updatedAt: nowIso,
    });

    warranties.push({
      id: uuid(),
      assetId: id,
      provider: s.warrantyProvider,
      startDate: s.purchaseDate,
      expiryDate: addDaysIso(today, s.warrantyDays),
      durationMonths: s.warrantyMonths,
      warrantyType: s.warrantyType,
      extendedDetails:
        s.warrantyType === 'Extended Care'
          ? 'Comprehensive zero-depreciation parts & labor coverage'
          : s.warrantyType === 'AppleCare+'
          ? 'Accidental damage + battery protection plan'
          : 'Standard manufacturer hardware warranty',
      certificateDocumentId: null,
      createdAt,
      updatedAt: nowIso,
    });
  });

  const daikinTaskId = uuid();
  const boschTaskId = uuid();
  const brevilleTaskId = uuid();

  const maintenanceTasks: MaintenanceTaskRecord[] = [
    {
      id: daikinTaskId,
      assetId: daikinId,
      taskName: 'Clean Mesh & Anti-Dust Filter',
      maintenanceRequired: true,
      frequencyDays: 90,
      lastServiceDate: addDaysIso(today, -90),
      nextServiceDate: today,
      priority: 'High',
      serviceProviderId: null,
      serviceProviderName: 'Daikin Authorised Service',
      sparePartNumber: 'DKN-FLT-50',
      estimatedCost: 650,
      instructions:
        'Power off MCB 02, lift front intake grille, rinse anti-dust mesh under lukewarm water, and dry completely in shade.',
      notes: 'Due today for seasonal cooling efficiency.',
      isCompleted: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: boschTaskId,
      assetId: boschWasherId,
      taskName: 'Clean Inlet Water Mesh & Drain Trap',
      maintenanceRequired: true,
      frequencyDays: 60,
      lastServiceDate: addDaysIso(today, -62),
      nextServiceDate: addDaysIso(today, -2),
      priority: 'Medium',
      serviceProviderId: null,
      serviceProviderName: 'Bosch Care India',
      sparePartNumber: 'BSH-INL-06',
      estimatedCost: 0,
      instructions:
        'Shut off inlet tap, unscrew rear hose collar, clean sediment mesh, and clear front coin trap.',
      notes: 'Prevents Error Code E04.',
      isCompleted: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: brevilleTaskId,
      assetId: brevilleId,
      taskName: 'Group Head Backflush & Descale Cycle',
      maintenanceRequired: true,
      frequencyDays: 45,
      lastServiceDate: addDaysIso(today, -45),
      nextServiceDate: today,
      priority: 'Medium',
      serviceProviderId: null,
      serviceProviderName: 'Home Routine (DIY)',
      sparePartNumber: 'BRV-BES008-TAB',
      estimatedCost: 350,
      instructions:
        'Insert blind cleaning disc with 1 espresso cleaning tablet and run 2-cup cycle.',
      notes: 'Keep espresso extraction pressure at 9 bar.',
      isCompleted: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const maintenanceHistory: MaintenanceHistoryRecord[] = [
    {
      id: uuid(),
      taskId: daikinTaskId,
      assetId: daikinId,
      taskName: 'Annual Deep Jet-Pump Coil Wash & Gas Check',
      completedDate: addDaysIso(today, -90),
      serviceProviderName: 'Daikin Authorised Service',
      cost: 2400,
      notes: 'Outdoor condenser fin wash and R32 refrigerant pressure verified.',
      createdAt: nowIso,
    },
  ];

  const boschManualId = uuid();
  const daikinInvoiceId = uuid();
  const appleCareCertId = uuid();

  const boschPdfBytes = getSeededBoschManualPdfBytes();

  const documents: DocumentWithLinks[] = [
    {
      id: boschManualId,
      title: 'Bosch Serie 6 Washer — User Manual',
      fileName: 'Bosch Serie 6 Washer — User Manual.pdf',
      filePath: 'builtin:bosch_serie6_manual.pdf',
      mimeType: 'application/pdf',
      extension: 'pdf',
      fileSizeBytes: boschPdfBytes.byteLength,
      category: 'User Manuals',
      sha256Hash: 'seeded-manual-bosch-serie-6',
      pageCount: 36,
      isMissing: false,
      relativePath: 'Sample/User Manuals/Bosch Serie 6 Washer — User Manual.pdf',
      fileModifiedAt: nowIso,
      integrityStatus: 'builtin',
      observedSha256: 'seeded-manual-bosch-serie-6',
      lastVerifiedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
      linkedAssetIds: [boschWasherId],
    },
    {
      id: daikinInvoiceId,
      title: 'Croma Tax Invoice — Daikin FTKM50U',
      fileName: 'CRM-MUM-81204-Daikin-AC.pdf',
      filePath: 'builtin:bosch_serie6_manual.pdf',
      mimeType: 'application/pdf',
      extension: 'pdf',
      fileSizeBytes: 14280,
      category: 'Invoices',
      sha256Hash: 'seeded-invoice-daikin',
      pageCount: 1,
      isMissing: false,
      relativePath: 'Sample/Invoices/CRM-MUM-81204-Daikin-AC.pdf',
      fileModifiedAt: nowIso,
      integrityStatus: 'builtin',
      observedSha256: 'seeded-invoice-daikin',
      lastVerifiedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
      linkedAssetIds: [daikinId],
    },
    {
      id: appleCareCertId,
      title: 'AppleCare+ Coverage Agreement — MBP16',
      fileName: 'AppleCarePlus-C02ZN492MD6R.pdf',
      filePath: 'builtin:bosch_serie6_manual.pdf',
      mimeType: 'application/pdf',
      extension: 'pdf',
      fileSizeBytes: 18420,
      category: 'Warranty Certificates',
      sha256Hash: 'seeded-cert-applecare',
      pageCount: 2,
      isMissing: false,
      relativePath: 'Sample/Warranty Certificates/AppleCarePlus-C02ZN492MD6R.pdf',
      fileModifiedAt: nowIso,
      integrityStatus: 'builtin',
      observedSha256: 'seeded-cert-applecare',
      lastVerifiedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
      linkedAssetIds: [assets[4].id],
    },
  ];

  const documentPages: DocumentPageIndex[] = [
    {
      documentId: boschManualId,
      pageNumber: 34,
      content:
        'Error Code E04: Water supply tap closed or inlet filter blocked. Turn off tap and clean mesh filter at the water inlet valve before restarting wash cycle.',
    },
    {
      documentId: boschManualId,
      pageNumber: 1,
      content:
        'Bosch Serie 6 Front-Load Washing Machine User Manual Model WAJ2846IN. Page 34 Troubleshooting Error Codes E01-E18.',
    },
    {
      documentId: daikinInvoiceId,
      pageNumber: 1,
      content:
        'Croma Electronics Tax Invoice CRM-MUM-81204. Daikin 1.5 Ton Inverter Split AC FTKM50U Serial DK992841004X INR 44,200.',
    },
  ];

  const paintRecords: PaintRecord[] = [
    {
      id: uuid(),
      roomName: 'Living Room',
      brand: 'Asian Paints Royale',
      colorName: 'Warm Alabaster',
      hexCode: '#F2EFE9',
      finish: 'Eggshell',
      notes: '2 coats over primer, north & west walls',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: uuid(),
      roomName: 'Master Bedroom',
      brand: 'Dulux Velvet',
      colorName: 'Mist Slate',
      hexCode: '#DCE3E8',
      finish: 'Matte',
      notes: 'Accent headboard & side walls',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const breakers: ElectricalBreaker[] = [
    {
      id: uuid(),
      breakerNumber: '01',
      circuitLabel: 'Kitchen Heavy Appliances',
      amperage: '32A',
      zone: 'Main DB',
      notes: 'Dishwasher, Oven, Espresso & Fridge dedicated spur',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: uuid(),
      breakerNumber: '02',
      circuitLabel: 'Master AC & Geyser',
      amperage: '20A',
      zone: 'Main DB',
      notes: 'Daikin 1.5T Inverter Split AC + 25L Storage Heater',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: uuid(),
      breakerNumber: '03',
      circuitLabel: 'Living Room & Router UPS',
      amperage: '16A',
      zone: 'UPS Backup',
      notes: 'OLED TV, Sonos Arc & Fibernet ONT backed by Luminous UPS',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const network: NetworkSetting[] = [
    {
      id: uuid(),
      routerName: 'Primary Mesh Gateway',
      model: 'ASUS ZenWiFi XT8 (AX6600)',
      ssid: APP_BRAND.sampleWifiSsid,
      encryptedPassword: 'HV-Mesh@2026#Secure',
      ipAddress: '192.168.50.1',
      notes: 'Dual-band Wi-Fi 6 backhaul wired to Living Room & Study',
      updatedAt: nowIso,
    },
  ];

  const utilities: UtilityRecord[] = [
    {
      id: uuid(),
      serviceType: 'Fiber Broadband (ISP)',
      providerName: 'ACT Fibernet Gigabit',
      accountNumber: 'ACT-1092847102',
      supportContact: 'support@actcorp.in',
      vendorPhone: '+91 91212 12121',
      notes: '1 Gbps symmetrical plan, static IP enabled',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: uuid(),
      serviceType: 'Water Purifier AMC',
      providerName: 'AO Smith Authorized Care',
      accountNumber: 'AOS-AMC-88420',
      supportContact: 'customercare@aosmithindia.com',
      vendorPhone: '+91 80 4129 9000',
      notes: 'Filter cartridge replacement every 6 months',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  return {
    assets,
    warranties,
    maintenanceTasks,
    maintenanceHistory,
    documents,
    documentPages,
    paintRecords,
    breakers,
    network,
    utilities,
  };
}

function loadDb(): PreviewDatabase {
  const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) {
    const clean = createCleanSeed();
    saveDb(clean);
    return clean;
  }
  try {
    const parsed = JSON.parse(raw) as PreviewDatabase;
    parsed.settings = normalizeSettings(parsed.settings);
    if (!parsed.settings.storagePath) {
      parsed.settings.storagePath = DEFAULT_PREVIEW_STORAGE_PATH;
    }
    return parsed;
  } catch {
    const clean = createCleanSeed();
    saveDb(clean);
    return clean;
  }
}

function saveDb(db: PreviewDatabase): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function recalculateAssetTco(db: PreviewDatabase, assetId: string): void {
  const asset = db.assets.find((a) => a.id === assetId);
  if (!asset) return;
  const serviceCost = db.maintenanceHistory
    .filter((h) => h.assetId === assetId)
    .reduce((sum, h) => sum + h.cost, 0);
  asset.totalCostOfOwnership = asset.purchasePrice + serviceCost;
}

export const browserPreviewAdapter = {
  async listAssets(): Promise<AssetRecord[]> {
    const db = loadDb();
    return [...db.assets];
  },

  async listCategories(): Promise<Category[]> {
    return loadDb().categories;
  },

  async listLocations(): Promise<Location[]> {
    return loadDb().locations;
  },

  async upsertAsset(input: UpsertAssetInput): Promise<string> {
    if (!input.name.trim()) throw new Error('Asset name is required.');
    const db = loadDb();
    const nowIso = new Date().toISOString();

    let cat = db.categories.find((c) => c.name === input.categoryName);
    if (!cat) {
      cat = { id: uuid(), name: input.categoryName, icon: 'box', sortOrder: 99, createdAt: nowIso };
      db.categories.push(cat);
    }

    let loc = db.locations.find((l) => l.name === input.locationName);
    if (!loc) {
      loc = {
        id: uuid(),
        name: input.locationName,
        groupName: HOUSEHOLD_DEFAULTS.residenceName,
        sortOrder: 99,
        createdAt: nowIso,
      };
      db.locations.push(loc);
    }

    if (input.id) {
      const idx = db.assets.findIndex((a) => a.id === input.id);
      if (idx === -1) throw new Error('Asset not found.');
      const existing = db.assets[idx];
      db.assets[idx] = {
        ...existing,
        name: input.name.trim(),
        categoryId: cat.id,
        categoryName: cat.name,
        locationId: loc.id,
        locationName: loc.name,
        brand: input.brand,
        model: input.model,
        description: input.description,
        serialNumber: input.serialNumber,
        productId: input.productId,
        imei: input.imei,
        qrBarcode: input.qrBarcode,
        status: input.status,
        photoPath: input.photoPath ?? existing.photoPath,
        serialPhotoPath: input.serialPhotoPath ?? existing.serialPhotoPath,
        purchaseDate: input.purchaseDate,
        purchasePrice: Number(input.purchasePrice) || 0,
        currency: input.currency || 'INR',
        retailer: input.retailer,
        invoiceNumber: input.invoiceNumber,
        paymentMethod: input.paymentMethod,
        purchaseNotes: input.purchaseNotes,
        updatedAt: nowIso,
      };
      recalculateAssetTco(db, existing.id);
      saveDb(db);
      return existing.id;
    }

    const id = uuid();
    const newAsset: AssetRecord = {
      id,
      name: input.name.trim(),
      categoryId: cat.id,
      categoryName: cat.name,
      locationId: loc.id,
      locationName: loc.name,
      brand: input.brand,
      model: input.model,
      description: input.description,
      serialNumber: input.serialNumber,
      productId: input.productId,
      imei: input.imei,
      qrBarcode: input.qrBarcode,
      status: input.status,
      photoPath: input.photoPath ?? null,
      serialPhotoPath: input.serialPhotoPath ?? null,
      isFeatured: true,
      purchaseDate: input.purchaseDate,
      purchasePrice: Number(input.purchasePrice) || 0,
      currency: input.currency || 'INR',
      retailer: input.retailer,
      invoiceNumber: input.invoiceNumber,
      paymentMethod: input.paymentMethod,
      purchaseNotes: input.purchaseNotes,
      totalCostOfOwnership: Number(input.purchasePrice) || 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.assets.unshift(newAsset);

    if (input.warrantyProvider?.trim() && input.warrantyStartDate && input.warrantyExpiryDate) {
      db.warranties.push({
        id: uuid(),
        assetId: id,
        provider: input.warrantyProvider.trim(),
        startDate: input.warrantyStartDate,
        expiryDate: input.warrantyExpiryDate,
        durationMonths: input.warrantyDurationMonths ?? 12,
        warrantyType: input.warrantyType ?? 'Manufacturer',
        extendedDetails: input.warrantyExtendedDetails ?? '',
        certificateDocumentId: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    if (input.maintenanceRequired && input.maintenanceTaskName?.trim() && input.maintenanceNextServiceDate) {
      db.maintenanceTasks.push({
        id: uuid(),
        assetId: id,
        taskName: input.maintenanceTaskName.trim(),
        maintenanceRequired: true,
        frequencyDays: input.maintenanceFrequencyDays ?? 90,
        lastServiceDate: input.maintenanceLastServiceDate || null,
        nextServiceDate: input.maintenanceNextServiceDate,
        priority: 'Medium',
        serviceProviderId: null,
        serviceProviderName: input.maintenanceServiceProvider ?? '',
        sparePartNumber: input.maintenanceSparePartNumber ?? '',
        estimatedCost: 0,
        instructions: input.maintenanceInstructions ?? '',
        notes: '',
        isCompleted: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    saveDb(db);
    return id;
  },

  async deleteAsset(assetId: string): Promise<void> {
    const db = loadDb();
    db.assets = db.assets.filter((a) => a.id !== assetId);
    db.warranties = db.warranties.filter((w) => w.assetId !== assetId);
    db.maintenanceTasks = db.maintenanceTasks.filter((t) => t.assetId !== assetId);
    db.maintenanceHistory = db.maintenanceHistory.filter((h) => h.assetId !== assetId);
    db.documents = db.documents.map((d) => ({
      ...d,
      linkedAssetIds: d.linkedAssetIds.filter((id) => id !== assetId),
    }));
    saveDb(db);
  },

  async listWarranties(): Promise<WarrantyRecord[]> {
    return loadDb().warranties;
  },

  async upsertWarranty(input: UpsertWarrantyInput): Promise<WarrantyRecord> {
    const db = loadDb();
    const nowIso = new Date().toISOString();
    if (input.id) {
      const idx = db.warranties.findIndex((w) => w.id === input.id);
      if (idx === -1) throw new Error('Warranty not found.');
      db.warranties[idx] = { ...db.warranties[idx], ...input, updatedAt: nowIso };
      saveDb(db);
      return db.warranties[idx];
    }
    const created: WarrantyRecord = {
      id: uuid(),
      assetId: input.assetId,
      provider: input.provider,
      startDate: input.startDate,
      expiryDate: input.expiryDate,
      durationMonths: input.durationMonths,
      warrantyType: input.warrantyType,
      extendedDetails: input.extendedDetails,
      certificateDocumentId: input.certificateDocumentId ?? null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    db.warranties.push(created);
    saveDb(db);
    return created;
  },

  async deleteWarranty(warrantyId: string): Promise<void> {
    const db = loadDb();
    db.warranties = db.warranties.filter((w) => w.id !== warrantyId);
    saveDb(db);
  },

  async listMaintenanceTasks(): Promise<MaintenanceTaskRecord[]> {
    return loadDb().maintenanceTasks;
  },

  async listMaintenanceHistory(): Promise<MaintenanceHistoryRecord[]> {
    return loadDb().maintenanceHistory;
  },

  async upsertMaintenanceTask(input: UpsertMaintenanceTaskInput): Promise<MaintenanceTaskRecord> {
    const db = loadDb();
    const nowIso = new Date().toISOString();
    if (input.id) {
      const idx = db.maintenanceTasks.findIndex((t) => t.id === input.id);
      if (idx === -1) throw new Error('Maintenance task not found.');
      db.maintenanceTasks[idx] = { ...db.maintenanceTasks[idx], ...input, updatedAt: nowIso };
      saveDb(db);
      return db.maintenanceTasks[idx];
    }
    const created: MaintenanceTaskRecord = {
      id: uuid(),
      assetId: input.assetId,
      taskName: input.taskName,
      maintenanceRequired: input.maintenanceRequired,
      frequencyDays: input.frequencyDays,
      lastServiceDate: input.lastServiceDate ?? null,
      nextServiceDate: input.nextServiceDate,
      priority: input.priority,
      serviceProviderId: null,
      serviceProviderName: input.serviceProviderName,
      sparePartNumber: input.sparePartNumber,
      estimatedCost: Number(input.estimatedCost) || 0,
      instructions: input.instructions,
      notes: input.notes,
      isCompleted: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    db.maintenanceTasks.push(created);
    saveDb(db);
    return created;
  },

  async completeMaintenanceTask(input: {
    taskId: string;
    completedDate: string;
    cost: number;
    serviceProviderName?: string;
    notes: string;
  }): Promise<MaintenanceTaskRecord> {
    const db = loadDb();
    const idx = db.maintenanceTasks.findIndex((t) => t.id === input.taskId);
    if (idx === -1) throw new Error('Maintenance task not found.');
    const task = db.maintenanceTasks[idx];
    const nowIso = new Date().toISOString();

    const nextDate = addDaysIso(input.completedDate, Math.max(1, task.frequencyDays || 90));
    const provider = input.serviceProviderName ?? task.serviceProviderName;

    db.maintenanceHistory.unshift({
      id: uuid(),
      taskId: task.id,
      assetId: task.assetId,
      taskName: task.taskName,
      completedDate: input.completedDate,
      serviceProviderName: provider,
      cost: Number(input.cost) || 0,
      notes: input.notes,
      createdAt: nowIso,
    });

    db.maintenanceTasks[idx] = {
      ...task,
      lastServiceDate: input.completedDate,
      nextServiceDate: nextDate,
      isCompleted: task.frequencyDays <= 0,
      updatedAt: nowIso,
    };

    recalculateAssetTco(db, task.assetId);
    saveDb(db);
    return db.maintenanceTasks[idx];
  },

  async deleteMaintenanceTask(taskId: string): Promise<void> {
    const db = loadDb();
    db.maintenanceTasks = db.maintenanceTasks.filter((t) => t.id !== taskId);
    saveDb(db);
  },

  async listDocuments(): Promise<DocumentWithLinks[]> {
    return loadDb().documents;
  },

  async importDocumentBrowser(
    file: File,
    title: string,
    category: DocumentWithLinks['category'],
    linkedAssetIds: string[],
    extractedPages?: Array<{ pageNumber: number; content: string }>
  ): Promise<DocumentWithLinks> {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!(SUPPORTED_DOCUMENT_EXTENSIONS as readonly string[]).includes(ext)) {
      throw new Error(`Unsupported file extension .${ext}`);
    }
    const buffer = await file.arrayBuffer();
    const hash = await sha256Hex(buffer);
    const id = uuid();
    const nowIso = new Date().toISOString();
    const relativePath = buildStructuredRelativePath(category, file.name, id);
    const db = loadDb();
    const rootPath = db.settings.storagePath || DEFAULT_PREVIEW_STORAGE_PATH;
    const sep = rootPath.includes('\\') ? '\\' : '/';
    const fullDisplayPath = `${rootPath.replace(/[\\/]+$/, '')}${sep}${relativePath.replace(/\//g, sep)}`;

    await putPreviewBlob(id, buffer);

    const doc: DocumentWithLinks = {
      id,
      title: title.trim() || file.name.replace(/\.[^.]+$/, ''),
      fileName: file.name,
      filePath: fullDisplayPath,
      mimeType: file.type || 'application/octet-stream',
      extension: ext,
      fileSizeBytes: buffer.byteLength,
      category,
      sha256Hash: hash,
      pageCount: extractedPages?.length ? extractedPages.length : 1,
      isMissing: false,
      relativePath,
      fileModifiedAt: new Date(file.lastModified || Date.now()).toISOString(),
      integrityStatus: 'verified',
      observedSha256: hash,
      lastVerifiedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
      linkedAssetIds,
    };

    db.documents.unshift(doc);
    if (extractedPages && extractedPages.length > 0) {
      for (const page of extractedPages) {
        if (page.content.trim()) {
          db.documentPages.push({
            documentId: id,
            pageNumber: page.pageNumber,
            content: page.content,
          });
        }
      }
    }
    saveDb(db);
    return doc;
  },

  async verifyDocumentsIntegrity(): Promise<IntegrityReport> {
    const db = loadDb();
    const checkedAt = new Date().toISOString();
    let totalChecked = 0;
    let verifiedCount = 0;
    let modifiedCount = 0;
    let missingCount = 0;

    for (let i = 0; i < db.documents.length; i++) {
      const doc = db.documents[i];
      if (doc.filePath.startsWith('builtin:')) {
        db.documents[i] = { ...doc, integrityStatus: 'builtin', lastVerifiedAt: checkedAt };
        continue;
      }
      totalChecked += 1;
      const blob = await getPreviewBlob(doc.id);
      if (!blob) {
        missingCount += 1;
        db.documents[i] = {
          ...doc,
          isMissing: true,
          integrityStatus: 'missing',
          observedSha256: '',
          lastVerifiedAt: checkedAt,
        };
        continue;
      }
      const actualHash = await sha256Hex(blob);
      const isMatch = !doc.sha256Hash || actualHash === doc.sha256Hash;
      if (isMatch) verifiedCount += 1;
      else modifiedCount += 1;
      db.documents[i] = {
        ...doc,
        isMissing: false,
        integrityStatus: isMatch ? 'verified' : 'modified',
        observedSha256: actualHash,
        lastVerifiedAt: checkedAt,
      };
    }

    saveDb(db);
    return { totalChecked, verifiedCount, modifiedCount, missingCount, checkedAt };
  },

  async acceptModifiedDocument(documentId: string): Promise<DocumentWithLinks> {
    const db = loadDb();
    const idx = db.documents.findIndex((d) => d.id === documentId);
    if (idx === -1) throw new Error('Document not found.');
    const doc = db.documents[idx];
    const blob = await getPreviewBlob(doc.id);
    if (!blob) throw new Error('File binary missing from local store.');
    const newHash = await sha256Hex(blob);
    const nowIso = new Date().toISOString();
    db.documents[idx] = {
      ...doc,
      sha256Hash: newHash,
      observedSha256: newHash,
      fileSizeBytes: blob.byteLength,
      fileModifiedAt: nowIso,
      integrityStatus: 'verified',
      isMissing: false,
      lastVerifiedAt: nowIso,
      updatedAt: nowIso,
    };
    saveDb(db);
    return db.documents[idx];
  },

  async updateDocumentMetadata(
    documentId: string,
    title: string,
    category: DocumentWithLinks['category'],
    linkedAssetIds: string[]
  ): Promise<void> {
    const db = loadDb();
    const idx = db.documents.findIndex((d) => d.id === documentId);
    if (idx === -1) throw new Error('Document not found.');
    const prev = db.documents[idx];
    let nextRel = prev.relativePath;
    let nextPath = prev.filePath;
    if (prev.category !== category && !prev.filePath.startsWith('builtin:')) {
      const year = new Date(prev.createdAt || Date.now()).getFullYear();
      nextRel = buildStructuredRelativePath(category, prev.fileName, prev.id, year);
      const rootPath = db.settings.storagePath || DEFAULT_PREVIEW_STORAGE_PATH;
      const sep = rootPath.includes('\\') ? '\\' : '/';
      nextPath = `${rootPath.replace(/[\\/]+$/, '')}${sep}${nextRel.replace(/\//g, sep)}`;
    }
    db.documents[idx] = {
      ...prev,
      title: title.trim(),
      category,
      relativePath: nextRel,
      filePath: nextPath,
      linkedAssetIds,
      updatedAt: new Date().toISOString(),
    };
    saveDb(db);
  },

  async deleteDocument(documentId: string): Promise<void> {
    const db = loadDb();
    db.documents = db.documents.filter((d) => d.id !== documentId);
    db.documentPages = db.documentPages.filter((p) => p.documentId !== documentId);
    saveDb(db);
    await deletePreviewBlob(documentId).catch(() => {});
  },

  async globalSearch(query: string): Promise<SearchHit[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const db = loadDb();
    const hits: SearchHit[] = [];

    for (const a of db.assets) {
      if (
        a.name.toLowerCase().includes(q) ||
        a.brand.toLowerCase().includes(q) ||
        a.model.toLowerCase().includes(q) ||
        a.serialNumber.toLowerCase().includes(q) ||
        a.productId.toLowerCase().includes(q) ||
        a.locationName.toLowerCase().includes(q)
      ) {
        hits.push({
          kind: 'asset',
          id: a.id,
          title: a.name,
          subtitle: `${a.brand} · ${a.model} · ${a.locationName}`,
          snippet: `Serial: ${a.serialNumber || '—'} · Product ID: ${a.productId || '—'}`,
          assetId: a.id,
          documentId: null,
          pageNumber: null,
        });
      }
    }

    for (const p of db.documentPages) {
      if (p.content.toLowerCase().includes(q)) {
        const doc = db.documents.find((d) => d.id === p.documentId);
        if (doc) {
          hits.push({
            kind: 'manual_page',
            id: `${p.documentId}:${p.pageNumber}`,
            title: doc.fileName,
            subtitle: `Page ${p.pageNumber}`,
            snippet: p.content,
            assetId: doc.linkedAssetIds[0] ?? null,
            documentId: doc.id,
            pageNumber: p.pageNumber,
          });
        }
      }
    }

    for (const d of db.documents) {
      if (d.title.toLowerCase().includes(q) || d.fileName.toLowerCase().includes(q)) {
        hits.push({
          kind: 'document',
          id: d.id,
          title: d.title,
          subtitle: `${d.category} · ${d.fileName}`,
          snippet: `${d.pageCount} pages`,
          assetId: d.linkedAssetIds[0] ?? null,
          documentId: d.id,
          pageNumber: 1,
        });
      }
    }

    return hits.slice(0, 24);
  },

  async getPropertySpecs(): Promise<PropertySpecsBundle> {
    const db = loadDb();
    return {
      paintRecords: db.paintRecords,
      breakers: db.breakers,
      network: db.network,
      utilities: db.utilities,
    };
  },

  async upsertPaintRecord(record: Omit<PaintRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<void> {
    const db = loadDb();
    const nowIso = new Date().toISOString();
    if (record.id) {
      const idx = db.paintRecords.findIndex((p) => p.id === record.id);
      if (idx !== -1) {
        db.paintRecords[idx] = { ...db.paintRecords[idx], ...record, updatedAt: nowIso };
      }
    } else {
      db.paintRecords.push({ ...record, id: uuid(), createdAt: nowIso, updatedAt: nowIso });
    }
    saveDb(db);
  },

  async deletePaintRecord(id: string): Promise<void> {
    const db = loadDb();
    db.paintRecords = db.paintRecords.filter((p) => p.id !== id);
    saveDb(db);
  },

  async upsertElectricalBreaker(record: Omit<ElectricalBreaker, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<void> {
    const db = loadDb();
    const nowIso = new Date().toISOString();
    if (record.id) {
      const idx = db.breakers.findIndex((b) => b.id === record.id);
      if (idx !== -1) {
        db.breakers[idx] = { ...db.breakers[idx], ...record, updatedAt: nowIso };
      }
    } else {
      db.breakers.push({ ...record, id: uuid(), createdAt: nowIso, updatedAt: nowIso });
    }
    saveDb(db);
  },

  async deleteElectricalBreaker(id: string): Promise<void> {
    const db = loadDb();
    db.breakers = db.breakers.filter((b) => b.id !== id);
    saveDb(db);
  },

  async upsertNetworkSetting(record: Omit<NetworkSetting, 'id' | 'updatedAt'> & { id?: string }): Promise<void> {
    const db = loadDb();
    const nowIso = new Date().toISOString();
    if (record.id) {
      const idx = db.network.findIndex((n) => n.id === record.id);
      if (idx !== -1) {
        db.network[idx] = { ...db.network[idx], ...record, updatedAt: nowIso };
      }
    } else {
      db.network.push({ ...record, id: uuid(), updatedAt: nowIso });
    }
    saveDb(db);
  },

  async upsertUtilityRecord(record: Omit<UtilityRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<void> {
    const db = loadDb();
    const nowIso = new Date().toISOString();
    if (record.id) {
      const idx = db.utilities.findIndex((u) => u.id === record.id);
      if (idx !== -1) {
        db.utilities[idx] = { ...db.utilities[idx], ...record, updatedAt: nowIso };
      }
    } else {
      db.utilities.push({ ...record, id: uuid(), createdAt: nowIso, updatedAt: nowIso });
    }
    saveDb(db);
  },

  async deleteUtilityRecord(id: string): Promise<void> {
    const db = loadDb();
    db.utilities = db.utilities.filter((u) => u.id !== id);
    saveDb(db);
  },

  async exportInsurancePackage(request: InsuranceExportRequest): Promise<InsuranceExportResult> {
    if (!request.password || request.password.trim().length < 6) {
      throw new Error('Encryption password must be at least 6 characters.');
    }
    const db = loadDb();
    const assets =
      request.roomFilter && request.roomFilter !== 'All'
        ? db.assets.filter((a) => a.locationName === request.roomFilter)
        : db.assets;

    const zip = new JSZip();
    const csvRows = [
      'ID,Name,Category,Location,Brand,Model,SerialNumber,PurchaseDate,PurchasePriceINR,Retailer,TCO_INR',
      ...assets.map(
        (a) =>
          `"${a.id}","${a.name.replace(/"/g, '""')}","${a.categoryName}","${a.locationName}","${a.brand}","${a.model}","${a.serialNumber}","${a.purchaseDate}",${a.purchasePrice},"${a.retailer.replace(/"/g, '""')}",${a.totalCostOfOwnership}`
      ),
    ];
    zip.file('inventory.csv', csvRows.join('\n'));

    if (request.includeValuationPdf) {
      const pdfBytes = buildValuationReportPdfBytes(assets, request.roomFilter || 'Entire Home');
      zip.file(BACKUP_CONFIG.valuationReportFilename, pdfBytes);
    }

    if (request.includeMaintenanceHistory) {
      const mRows = [
        'AssetID,TaskName,CompletedDate,ServiceProvider,CostINR,Notes',
        ...db.maintenanceHistory.map(
          (h) =>
            `"${h.assetId}","${h.taskName.replace(/"/g, '""')}","${h.completedDate}","${h.serviceProviderName}",${h.cost},"${h.notes.replace(/"/g, '""')}"`
        ),
      ];
      zip.file('maintenance_history.csv', mRows.join('\n'));
    }

    for (const doc of db.documents) {
      const include =
        (doc.category === 'Invoices' || doc.category === 'Service Receipts')
          ? request.includeReceipts
          : doc.category === 'Serial Photos'
          ? request.includeSerialPhotos
          : doc.category === 'Warranty Certificates'
          ? request.includeWarranties
          : doc.category === 'User Manuals'
          ? request.includeManuals
          : true;
      if (!include) continue;
      const blob = await getPreviewBlob(doc.filePath.startsWith('builtin:') ? doc.filePath : doc.id);
      if (blob) {
        zip.file(`attachments/${doc.category}/${doc.fileName}`, blob);
      }
    }

    const zipBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    const filename = `${APP_BRAND.name}_Insurance_Pack_${todayIsoDate()}.zip`;
    triggerBrowserDownload(zipBytes, filename, 'application/zip');

    return {
      archivePath: `Downloads/${filename}`,
      assetCount: assets.length,
      totalValuation: assets.reduce((s, a) => s + a.purchasePrice, 0),
      fileSizeBytes: zipBytes.byteLength,
      encrypted: true,
    };
  },

  async listBackupHistory(): Promise<BackupHistoryRecord[]> {
    return loadDb().backups;
  },

  async createBackup(): Promise<BackupHistoryRecord> {
    const db = loadDb();
    const payload = JSON.stringify(db, null, 2);
    const dbBytes = new TextEncoder().encode(payload);
    const dbSha = await sha256Hex(dbBytes);
    const manifest: BackupManifest = {
      appVersion: APP_BRAND.version,
      createdAt: new Date().toISOString(),
      assetCount: db.assets.length,
      documentCount: db.documents.length,
      dbSha256: dbSha,
    };

    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    zip.file(BACKUP_CONFIG.previewDbEntryName, payload);

    for (const doc of db.documents) {
      if (!doc.filePath.startsWith('builtin:')) {
        const blob = await getPreviewBlob(doc.id);
        if (blob) zip.file(`attachments/${doc.id}_${doc.fileName}`, blob);
      }
    }

    const archiveBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    const checksum = await sha256Hex(archiveBytes);
    const archiveName = `${APP_BRAND.name}_Backup_${todayIsoDate()}_${Date.now().toString().slice(-4)}.${BACKUP_CONFIG.extension}`;

    triggerBrowserDownload(archiveBytes, archiveName, 'application/zip');

    const record: BackupHistoryRecord = {
      id: uuid(),
      archiveName,
      archivePath: `Downloads/${archiveName}`,
      sizeBytes: archiveBytes.byteLength,
      assetCount: db.assets.length,
      documentCount: db.documents.length,
      sha256Checksum: checksum,
      backupType: 'manual',
      createdAt: new Date().toISOString(),
    };
    db.backups.unshift(record);
    saveDb(db);
    return record;
  },

  async validateBackupFileBrowser(file: File): Promise<BackupManifest> {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const manifestEntry = zip.file('manifest.json');
    const dbEntry =
      zip.file(BACKUP_CONFIG.previewDbEntryName) ??
      zip.file(BACKUP_CONFIG.legacyPreviewDbEntryName);
    if (!manifestEntry || !dbEntry) {
      throw new Error(`Invalid ${APP_BRAND.name} backup archive: missing manifest or database payload.`);
    }
    const manifest = JSON.parse(await manifestEntry.async('string')) as BackupManifest;
    const dbStr = await dbEntry.async('string');
    const actualSha = await sha256Hex(new TextEncoder().encode(dbStr));
    if (actualSha !== manifest.dbSha256) {
      throw new Error('Backup checksum verification failed — file may be corrupted.');
    }
    return manifest;
  },

  async restoreFromBackupBrowser(file: File): Promise<BackupManifest> {
    const manifest = await this.validateBackupFileBrowser(file);
    // Pre-restore snapshot saved to sessionStorage for rollback
    const currentRaw = localStorage.getItem(STORAGE_KEY);
    if (currentRaw) {
      sessionStorage.setItem(STORAGE_KEYS.previewPreRestoreSnapshot, currentRaw);
    }
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const dbEntry =
      zip.file(BACKUP_CONFIG.previewDbEntryName) ??
      zip.file(BACKUP_CONFIG.legacyPreviewDbEntryName);
    if (!dbEntry) throw new Error('Database payload missing in backup.');
    const restoredDb = JSON.parse(await dbEntry.async('string')) as PreviewDatabase;
    saveDb(restoredDb);

    // Restore attachments into IndexedDB
    for (const [name, entry] of Object.entries(zip.files)) {
      if (name.startsWith('attachments/') && !entry.dir) {
        const docId = name.replace('attachments/', '').split('_')[0];
        const buf = await entry.async('arraybuffer');
        await putPreviewBlob(docId, buf);
      }
    }
    return manifest;
  },

  async getSettings(): Promise<AppSettings> {
    return normalizeSettings(loadDb().settings);
  },

  async updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    const db = loadDb();
    db.settings = normalizeSettings({ ...db.settings, ...partial });
    saveDb(db);
    return db.settings;
  },

  async getStorageConfig(): Promise<StorageConfig> {
    const db = loadDb();
    const active = db.settings.storagePath || DEFAULT_PREVIEW_STORAGE_PATH;
    return {
      storagePath: active,
      defaultStoragePath: DEFAULT_PREVIEW_STORAGE_PATH,
      isCustom: active !== DEFAULT_PREVIEW_STORAGE_PATH,
    };
  },

  async setStorageLocation(newPath: string, migrateExisting = true): Promise<StorageConfig> {
    const db = loadDb();
    const nextPath = newPath.trim() || DEFAULT_PREVIEW_STORAGE_PATH;
    const sep = nextPath.includes('\\') ? '\\' : '/';
    const cleanRoot = nextPath.replace(/[\\/]+$/, '');
    if (migrateExisting) {
      db.documents = db.documents.map((doc) =>
        doc.filePath.startsWith('builtin:') || !doc.relativePath
          ? doc
          : {
              ...doc,
              filePath: `${cleanRoot}${sep}${doc.relativePath.replace(/\//g, sep)}`,
            }
      );
    }
    db.settings = normalizeSettings({ ...db.settings, storagePath: nextPath });
    saveDb(db);
    return {
      storagePath: nextPath,
      defaultStoragePath: DEFAULT_PREVIEW_STORAGE_PATH,
      isCustom: nextPath !== DEFAULT_PREVIEW_STORAGE_PATH,
    };
  },

  async loadSampleData(): Promise<boolean> {
    const db = loadDb();
    if (db.assets.length > 0) return false;
    const sample = buildSampleSeedData(db.categories, db.locations);
    db.assets = sample.assets;
    db.warranties = sample.warranties;
    db.maintenanceTasks = sample.maintenanceTasks;
    db.maintenanceHistory = sample.maintenanceHistory;
    db.documents = sample.documents;
    db.documentPages = sample.documentPages;
    db.paintRecords = sample.paintRecords;
    db.breakers = sample.breakers;
    db.network = sample.network;
    db.utilities = sample.utilities;
    saveDb(db);
    return true;
  },

  async resetCleanVault(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY);
    loadDb();
  },
};

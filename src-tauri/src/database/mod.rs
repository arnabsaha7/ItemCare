use crate::errors::{AppError, AppResult};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqliteConnectOptions, sqlite::SqlitePoolOptions, SqlitePool};
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::sync::{Arc, RwLock};
use uuid::Uuid;

pub const CATEGORY_FOLDERS: &[&str] = &[
    "Invoices",
    "Warranty Certificates",
    "User Manuals",
    "Serial Photos",
    "Service Receipts",
    "Insurance Documents",
    "Property Documents",
    "Other",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VaultPathConfig {
    storage_dir: String,
}

pub struct AppState {
    pub pool: SqlitePool,
    pub vault_dir: PathBuf,
    pub db_path: PathBuf,
    pub default_storage_dir: PathBuf,
    pub storage_dir: Arc<RwLock<PathBuf>>,
}

pub fn ensure_storage_structure(storage_dir: &Path) -> AppResult<()> {
    let docs_root = storage_dir.join("Documents");
    let backups_dir = storage_dir.join("Backups");
    std::fs::create_dir_all(&docs_root)?;
    std::fs::create_dir_all(&backups_dir)?;
    for folder in CATEGORY_FOLDERS {
        std::fs::create_dir_all(docs_root.join(folder))?;
    }
    Ok(())
}

pub fn load_storage_config(vault_dir: &Path, default_storage_dir: &Path) -> PathBuf {
    let config_path = vault_dir.join("vault_config.json");
    if let Ok(raw) = std::fs::read_to_string(&config_path) {
        if let Ok(parsed) = serde_json::from_str::<VaultPathConfig>(&raw) {
            let trimmed = parsed.storage_dir.trim();
            if !trimmed.is_empty() {
                return PathBuf::from(trimmed);
            }
        }
    }
    default_storage_dir.to_path_buf()
}

pub fn save_storage_config(vault_dir: &Path, storage_dir: &Path) -> AppResult<()> {
    let config_path = vault_dir.join("vault_config.json");
    let cfg = VaultPathConfig {
        storage_dir: storage_dir.to_string_lossy().to_string(),
    };
    std::fs::write(config_path, serde_json::to_string_pretty(&cfg)?)?;
    Ok(())
}

pub async fn init_database(app_data_dir: &Path) -> AppResult<AppState> {
    let vault_dir = app_data_dir.join("HomeVault");
    let attachments_dir = vault_dir.join("attachments");
    let backups_dir = vault_dir.join("backups");
    let default_storage_dir = vault_dir.join("VaultFiles");
    std::fs::create_dir_all(&attachments_dir)?;
    std::fs::create_dir_all(&backups_dir)?;

    let active_storage_dir = load_storage_config(&vault_dir, &default_storage_dir);
    if ensure_storage_structure(&active_storage_dir).is_err() {
        ensure_storage_structure(&default_storage_dir)?;
    }

    let db_path = vault_dir.join("homevault.db");
    let db_url = format!("sqlite://{}", db_path.to_string_lossy());

    let connect_options = SqliteConnectOptions::from_str(&db_url)
        .map_err(|e| AppError::Internal(e.to_string()))?
        .create_if_missing(true)
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(8)
        .connect_with(connect_options)
        .await?;

    sqlx::migrate!("./src/database/migrations")
        .run(&pool)
        .await?;

    seed_lookup_defaults(&pool).await?;

    Ok(AppState {
        pool,
        vault_dir,
        db_path,
        default_storage_dir,
        storage_dir: Arc::new(RwLock::new(active_storage_dir)),
    })
}

async fn seed_lookup_defaults(pool: &SqlitePool) -> AppResult<()> {
    let now_iso = Utc::now().to_rfc3339();

    let categories = [
        ("Entertainment & AV", "tv", 1),
        ("Major Appliances", "washing-machine", 2),
        ("Climate & HVAC", "wind", 3),
        ("Kitchen Appliances", "coffee", 4),
        ("Computing & Mobile", "laptop", 5),
        ("Audio & Wearables", "headphones", 6),
        ("Furniture & Decor", "sofa", 7),
        ("Vehicles & Mobility", "car", 8),
        ("Tools & Utilities", "wrench", 9),
    ];

    for (name, icon, order) in categories {
        sqlx::query(
            "INSERT OR IGNORE INTO categories (id, name, icon, sort_order, created_at) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(Uuid::new_v4().to_string())
        .bind(name)
        .bind(icon)
        .bind(order)
        .bind(&now_iso)
        .execute(pool)
        .await?;
    }

    let locations = [
        ("Living Room", "Main Residence", 1),
        ("Kitchen", "Main Residence", 2),
        ("Master Bedroom", "Main Residence", 3),
        ("Utility & Garage", "Main Residence", 4),
        ("Vehicles", "Other Categories", 5),
        ("Everyday Carry", "Other Categories", 6),
    ];

    for (name, group_name, order) in locations {
        sqlx::query(
            "INSERT OR IGNORE INTO locations (id, name, group_name, sort_order, created_at) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(Uuid::new_v4().to_string())
        .bind(name)
        .bind(group_name)
        .bind(order)
        .bind(&now_iso)
        .execute(pool)
        .await?;
    }

    sqlx::query(
        "INSERT OR IGNORE INTO application_settings (key, value, updated_at) VALUES
         ('theme', 'light', ?),
         ('currency', 'INR', ?),
         ('warrantyAlertDays', '30', ?),
         ('notificationsEnabled', 'true', ?),
         ('ownerName', 'Homeowner', ?),
         ('residenceName', 'Main Residence', ?),
         ('ownerEmail', '', ?),
         ('onboardingCompleted', 'false', ?)",
    )
    .bind(&now_iso)
    .bind(&now_iso)
    .bind(&now_iso)
    .bind(&now_iso)
    .bind(&now_iso)
    .bind(&now_iso)
    .bind(&now_iso)
    .bind(&now_iso)
    .execute(pool)
    .await?;

    Ok(())
}

/// Populates sample household records on explicit user request when the vault is empty.
pub async fn load_sample_data(pool: &SqlitePool) -> AppResult<bool> {
    seed_lookup_defaults(pool).await?;

    let existing_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM assets")
        .fetch_one(pool)
        .await?;

    if existing_count.0 > 0 {
        return Ok(false);
    }

    let now = Utc::now();
    let now_iso = now.to_rfc3339();

    struct SeedAsset {
        name: &'static str,
        category: &'static str,
        location: &'static str,
        brand: &'static str,
        model: &'static str,
        serial: &'static str,
        product_id: &'static str,
        purchase_date: &'static str,
        price: f64,
        retailer: &'static str,
        invoice: &'static str,
        featured: bool,
        warranty_provider: &'static str,
        warranty_type: &'static str,
        warranty_days_offset: i64,
        warranty_duration_months: i64,
    }

    let today_str = now.format("%Y-%m-%d").to_string();
    let d_412 = (now + Duration::days(412)).format("%Y-%m-%d").to_string();
    let d_18 = (now + Duration::days(18)).format("%Y-%m-%d").to_string();
    let d_24 = (now + Duration::days(24)).format("%Y-%m-%d").to_string();
    let d_730 = (now + Duration::days(730)).format("%Y-%m-%d").to_string();
    let d_540 = (now + Duration::days(540)).format("%Y-%m-%d").to_string();
    let d_320 = (now + Duration::days(320)).format("%Y-%m-%d").to_string();
    let d_expired = (now - Duration::days(95)).format("%Y-%m-%d").to_string();

    let seeds = vec![
        SeedAsset {
            name: "LG C3 65\" OLED Evo TV",
            category: "Entertainment & AV",
            location: "Living Room",
            brand: "LG",
            model: "OLED65C3PSA",
            serial: "LG409IN65C3882",
            product_id: "OLED65C3-IN",
            purchase_date: "2024-06-15",
            price: 164990.0,
            retailer: "Reliance Digital",
            invoice: "RD-2024-99412",
            featured: true,
            warranty_provider: "LG India Care",
            warranty_type: "Extended Care",
            warranty_days_offset: 412,
            warranty_duration_months: 36,
        },
        SeedAsset {
            name: "Bosch Serie 6 Front-Load Washer",
            category: "Major Appliances",
            location: "Utility & Garage",
            brand: "Bosch",
            model: "WAJ2846IN",
            serial: "BSH88204199A",
            product_id: "SER6-9KG-IN",
            purchase_date: "2024-12-06",
            price: 48500.0,
            retailer: "Bosch Brand Store",
            invoice: "BSH-IN-44810",
            featured: true,
            warranty_provider: "Bosch Home Appliances",
            warranty_type: "Manufacturer",
            warranty_days_offset: 18,
            warranty_duration_months: 24,
        },
        SeedAsset {
            name: "Daikin 1.5 Ton Inverter Split AC",
            category: "Climate & HVAC",
            location: "Master Bedroom",
            brand: "Daikin",
            model: "FTKM50U",
            serial: "DK992841004X",
            product_id: "DKN-FTKM50U",
            purchase_date: "2024-03-14",
            price: 44200.0,
            retailer: "Croma Electronics",
            invoice: "CRM-MUM-81204",
            featured: true,
            warranty_provider: "Daikin Airconditioning India",
            warranty_type: "Manufacturer",
            warranty_days_offset: 320,
            warranty_duration_months: 60,
        },
        SeedAsset {
            name: "Breville Barista Express",
            category: "Kitchen Appliances",
            location: "Kitchen",
            brand: "Breville",
            model: "BES870XL",
            serial: "BRV77301928K",
            product_id: "BES870-BSS",
            purchase_date: "2025-01-20",
            price: 62000.0,
            retailer: "Something's Brewing",
            invoice: "SB-2025-1189",
            featured: true,
            warranty_provider: "Breville Care Plus",
            warranty_type: "Extended Care",
            warranty_days_offset: 730,
            warranty_duration_months: 36,
        },
        SeedAsset {
            name: "Apple MacBook Pro 16\" M3",
            category: "Computing & Mobile",
            location: "Everyday Carry",
            brand: "Apple",
            model: "MRW13HN/A",
            serial: "C02ZN492MD6R",
            product_id: "MBP16-M3PRO",
            purchase_date: "2024-09-02",
            price: 249900.0,
            retailer: "Apple BKC Mumbai",
            invoice: "APL-IN-551920",
            featured: true,
            warranty_provider: "AppleCare+",
            warranty_type: "AppleCare+",
            warranty_days_offset: 540,
            warranty_duration_months: 36,
        },
        SeedAsset {
            name: "Sony WH-1000XM5 Headphones",
            category: "Audio & Wearables",
            location: "Everyday Carry",
            brand: "Sony",
            model: "WH1000XM5/S",
            serial: "SNY50928174X",
            product_id: "WH1000XM5-SLV",
            purchase_date: "2024-02-11",
            price: 26990.0,
            retailer: "Amazon India",
            invoice: "AMZ-IN-774920",
            featured: true,
            warranty_provider: "Sony India",
            warranty_type: "Manufacturer",
            warranty_days_offset: -95,
            warranty_duration_months: 12,
        },
        SeedAsset {
            name: "Sonos Arc Soundbar + Sub Gen 3",
            category: "Entertainment & AV",
            location: "Living Room",
            brand: "Sonos",
            model: "ARCG1IN1BLK",
            serial: "SNS99281044B",
            product_id: "ARC-SUB-SET",
            purchase_date: "2024-07-04",
            price: 112000.0,
            retailer: "Audio Concept",
            invoice: "AC-2024-301",
            featured: false,
            warranty_provider: "Sonos India",
            warranty_type: "Manufacturer",
            warranty_days_offset: 320,
            warranty_duration_months: 24,
        },
        SeedAsset {
            name: "Natuzzi Editions Leather Sectional",
            category: "Furniture & Decor",
            location: "Living Room",
            brand: "Natuzzi",
            model: "B984-C02",
            serial: "NTZ3382019",
            product_id: "NTZ-SEC-GRY",
            purchase_date: "2023-11-18",
            price: 105000.0,
            retailer: "Natuzzi Flagship",
            invoice: "NTZ-23-198",
            featured: false,
            warranty_provider: "Natuzzi Structural",
            warranty_type: "Manufacturer",
            warranty_days_offset: 540,
            warranty_duration_months: 60,
        },
        SeedAsset {
            name: "Dyson Purifier Cool Formaldehyde",
            category: "Climate & HVAC",
            location: "Living Room",
            brand: "Dyson",
            model: "TP09",
            serial: "DYS88109234T",
            product_id: "DYS-TP09-WHT",
            purchase_date: "2024-11-28",
            price: 49900.0,
            retailer: "Dyson Demo Store",
            invoice: "DYS-91042",
            featured: false,
            warranty_provider: "Dyson India",
            warranty_type: "Manufacturer",
            warranty_days_offset: 24,
            warranty_duration_months: 24,
        },
        SeedAsset {
            name: "Apple TV 4K (3rd Gen Ethernet)",
            category: "Entertainment & AV",
            location: "Living Room",
            brand: "Apple",
            model: "MN893HN/A",
            serial: "F7P991028KL",
            product_id: "ATV4K-128G",
            purchase_date: "2024-06-15",
            price: 16900.0,
            retailer: "Imagine Store",
            invoice: "IMG-44821",
            featured: false,
            warranty_provider: "Apple India",
            warranty_type: "Manufacturer",
            warranty_days_offset: -95,
            warranty_duration_months: 12,
        },
        SeedAsset {
            name: "Custom Walnut Media Console",
            category: "Furniture & Decor",
            location: "Living Room",
            brand: "Stanley Level Next",
            model: "SLN-WLT-210",
            serial: "SLN-2024-089",
            product_id: "SLN-MED-210",
            purchase_date: "2024-01-12",
            price: 38500.0,
            retailer: "Stanley Boutique",
            invoice: "SLN-1129",
            featured: false,
            warranty_provider: "Stanley Care",
            warranty_type: "Manufacturer",
            warranty_days_offset: 320,
            warranty_duration_months: 36,
        },
        SeedAsset {
            name: "Samsung Bespoke French Door Fridge",
            category: "Major Appliances",
            location: "Kitchen",
            brand: "Samsung",
            model: "RF65A967FSG",
            serial: "SAM77201948K",
            product_id: "RF65-BESPOKE",
            purchase_date: "2024-04-20",
            price: 98000.0,
            retailer: "Samsung SmartPlaza",
            invoice: "SAM-88321",
            featured: false,
            warranty_provider: "Samsung India",
            warranty_type: "Extended Care",
            warranty_days_offset: 730,
            warranty_duration_months: 48,
        },
        SeedAsset {
            name: "Bosch Serie 6 Built-in Dishwasher",
            category: "Major Appliances",
            location: "Kitchen",
            brand: "Bosch",
            model: "SMS66GI01I",
            serial: "BSH55102938D",
            product_id: "SMS66-DW",
            purchase_date: "2024-05-09",
            price: 46500.0,
            retailer: "Croma Electronics",
            invoice: "CRM-88401",
            featured: false,
            warranty_provider: "Bosch India",
            warranty_type: "Manufacturer",
            warranty_days_offset: 320,
            warranty_duration_months: 24,
        },
        SeedAsset {
            name: "AO Smith ProPlanet P6 Water Purifier",
            category: "Kitchen Appliances",
            location: "Kitchen",
            brand: "AO Smith",
            model: "P6-RO-UV",
            serial: "AOS99182736R",
            product_id: "AOS-P6-RO",
            purchase_date: "2024-08-19",
            price: 21500.0,
            retailer: "AO Smith Direct",
            invoice: "AOS-2024-552",
            featured: false,
            warranty_provider: "AO Smith AMC",
            warranty_type: "Extended Care",
            warranty_days_offset: 320,
            warranty_duration_months: 24,
        },
        SeedAsset {
            name: "Faber 90cm Autoclean Chimney",
            category: "Kitchen Appliances",
            location: "Kitchen",
            brand: "Faber",
            model: "HOOD-CREST-90",
            serial: "FBR44920183",
            product_id: "FBR-CREST90",
            purchase_date: "2023-12-14",
            price: 24800.0,
            retailer: "Faber Platinum",
            invoice: "FBR-33019",
            featured: false,
            warranty_provider: "Faber India",
            warranty_type: "Manufacturer",
            warranty_days_offset: 540,
            warranty_duration_months: 60,
        },
        SeedAsset {
            name: "KitchenAid Artisan Stand Mixer",
            category: "Kitchen Appliances",
            location: "Kitchen",
            brand: "KitchenAid",
            model: "5KSM150PS",
            serial: "KTA11029384",
            product_id: "KSM150-EMP",
            purchase_date: "2024-09-25",
            price: 42900.0,
            retailer: "ThinKitchen",
            invoice: "TK-99201",
            featured: false,
            warranty_provider: "KitchenAid India",
            warranty_type: "Manufacturer",
            warranty_days_offset: 540,
            warranty_duration_months: 60,
        },
        SeedAsset {
            name: "Panasonic 32L Convection Microwave",
            category: "Kitchen Appliances",
            location: "Kitchen",
            brand: "Panasonic",
            model: "NN-CT645BFDG",
            serial: "PAN88291034",
            product_id: "NNCT645-BLK",
            purchase_date: "2024-03-01",
            price: 16400.0,
            retailer: "Vijay Sales",
            invoice: "VS-77312",
            featured: false,
            warranty_provider: "Panasonic India",
            warranty_type: "Manufacturer",
            warranty_days_offset: -95,
            warranty_duration_months: 12,
        },
        SeedAsset {
            name: "Elica 4-Burner Built-in Glass Hob",
            category: "Kitchen Appliances",
            location: "Kitchen",
            brand: "Elica",
            model: "FB-MFC-4B-70",
            serial: "ELC99283710",
            product_id: "ELC-HOB70",
            purchase_date: "2023-12-14",
            price: 19200.0,
            retailer: "Faber Platinum",
            invoice: "FBR-33020",
            featured: false,
            warranty_provider: "Elica Care",
            warranty_type: "Manufacturer",
            warranty_days_offset: 320,
            warranty_duration_months: 24,
        },
        SeedAsset {
            name: "Wakefit Ortho Plus King Mattress",
            category: "Furniture & Decor",
            location: "Master Bedroom",
            brand: "Wakefit",
            model: "WF-ORTHO-7872",
            serial: "WKF22019485",
            product_id: "WF-KING-8IN",
            purchase_date: "2024-01-05",
            price: 22990.0,
            retailer: "Wakefit Experience",
            invoice: "WF-441092",
            featured: false,
            warranty_provider: "Wakefit 10-Yr",
            warranty_type: "Manufacturer",
            warranty_days_offset: 730,
            warranty_duration_months: 120,
        },
        SeedAsset {
            name: "Philips Hue Gradient Bedroom Kit",
            category: "Entertainment & AV",
            location: "Master Bedroom",
            brand: "Philips Hue",
            model: "9290024687",
            serial: "PHL88392011",
            product_id: "HUE-GRAD-KIT",
            purchase_date: "2024-10-12",
            price: 18500.0,
            retailer: "Amazon India",
            invoice: "AMZ-IN-883201",
            featured: false,
            warranty_provider: "Signify India",
            warranty_type: "Manufacturer",
            warranty_days_offset: 320,
            warranty_duration_months: 24,
        },
        SeedAsset {
            name: "Teakwood Platform Bed & Sideboards",
            category: "Furniture & Decor",
            location: "Master Bedroom",
            brand: "Urban Ladder",
            model: "UL-TEAK-K01",
            serial: "UL-992018-M",
            product_id: "UL-KING-TK",
            purchase_date: "2023-11-22",
            price: 68500.0,
            retailer: "Urban Ladder Studio",
            invoice: "UL-77410",
            featured: false,
            warranty_provider: "Urban Ladder",
            warranty_type: "Manufacturer",
            warranty_days_offset: 540,
            warranty_duration_months: 36,
        },
        SeedAsset {
            name: "Luminous 1500VA Home Sine-Wave UPS",
            category: "Tools & Utilities",
            location: "Utility & Garage",
            brand: "Luminous",
            model: "Zelio+ 1700",
            serial: "LUM88291044",
            product_id: "ZELIO-1700",
            purchase_date: "2024-04-02",
            price: 18400.0,
            retailer: "Exide Care Hub",
            invoice: "EXC-2024-119",
            featured: false,
            warranty_provider: "Luminous Power",
            warranty_type: "Manufacturer",
            warranty_days_offset: 320,
            warranty_duration_months: 24,
        },
        SeedAsset {
            name: "Bosch EasyAquatak 120 Pressure Washer",
            category: "Tools & Utilities",
            location: "Utility & Garage",
            brand: "Bosch",
            model: "06008A79F0",
            serial: "BSH-PT-99102",
            product_id: "AQT-120",
            purchase_date: "2024-07-18",
            price: 9930.0,
            retailer: "Amazon India",
            invoice: "AMZ-IN-661209",
            featured: false,
            warranty_provider: "Bosch Power Tools",
            warranty_type: "Manufacturer",
            warranty_days_offset: 320,
            warranty_duration_months: 12,
        },
        SeedAsset {
            name: "Ather 450X Electric Scooter (3.7 kWh)",
            category: "Vehicles & Mobility",
            location: "Vehicles",
            brand: "Ather Energy",
            model: "450X-GEN3",
            serial: "MYH450X2024IN8891",
            product_id: "ATH-450X-37",
            purchase_date: "2024-05-24",
            price: 158500.0,
            retailer: "Ather Space Indiranagar",
            invoice: "ATH-BLR-90412",
            featured: false,
            warranty_provider: "Ather Battery Protect",
            warranty_type: "Extended Care",
            warranty_days_offset: 730,
            warranty_duration_months: 60,
        },
    ];

    let mut daikin_id = String::new();
    let mut bosch_washer_id = String::new();

    for (idx, s) in seeds.iter().enumerate() {
        let asset_id = Uuid::new_v4().to_string();
        if s.name.contains("Daikin") {
            daikin_id = asset_id.clone();
        }
        if s.name.contains("Bosch Serie 6 Front-Load") {
            bosch_washer_id = asset_id.clone();
        }

        let cat_row: (String,) = sqlx::query_as("SELECT id FROM categories WHERE name = ?")
            .bind(s.category)
            .fetch_one(pool)
            .await?;
        let loc_row: (String,) = sqlx::query_as("SELECT id FROM locations WHERE name = ?")
            .bind(s.location)
            .fetch_one(pool)
            .await?;

        let created_ts = (now - Duration::days((25 - idx) as i64)).to_rfc3339();

        sqlx::query(
            "INSERT INTO assets (id, name, category_id, location_id, brand, model, description, serial_number, product_id, imei, qr_barcode, status, is_featured, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, 'active', ?, ?, ?)"
        )
        .bind(&asset_id)
        .bind(s.name)
        .bind(&cat_row.0)
        .bind(&loc_row.0)
        .bind(s.brand)
        .bind(s.model)
        .bind(format!("{} {} registered in {}", s.brand, s.model, s.location))
        .bind(s.serial)
        .bind(s.product_id)
        .bind(format!("HV-{}", s.serial))
        .bind(if s.featured { 1 } else { 0 })
        .bind(&created_ts)
        .bind(&now_iso)
        .execute(pool)
        .await?;

        sqlx::query(
            "INSERT INTO purchases (id, asset_id, purchase_date, purchase_price, currency, retailer, invoice_number, payment_method, notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'INR', ?, ?, 'HDFC Regalia Credit Card', '', ?, ?)"
        )
        .bind(Uuid::new_v4().to_string())
        .bind(&asset_id)
        .bind(s.purchase_date)
        .bind(s.price)
        .bind(s.retailer)
        .bind(s.invoice)
        .bind(&created_ts)
        .bind(&now_iso)
        .execute(pool)
        .await?;

        let expiry_str = match s.warranty_days_offset {
            412 => d_412.clone(),
            18 => d_18.clone(),
            24 => d_24.clone(),
            730 => d_730.clone(),
            540 => d_540.clone(),
            -95 => d_expired.clone(),
            _ => d_320.clone(),
        };

        sqlx::query(
            "INSERT INTO warranties (id, asset_id, provider, start_date, expiry_date, duration_months, warranty_type, extended_details, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?)"
        )
        .bind(Uuid::new_v4().to_string())
        .bind(&asset_id)
        .bind(s.warranty_provider)
        .bind(s.purchase_date)
        .bind(&expiry_str)
        .bind(s.warranty_duration_months)
        .bind(s.warranty_type)
        .bind(&created_ts)
        .bind(&now_iso)
        .execute(pool)
        .await?;
    }

    let daikin_task_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO maintenance_tasks (id, asset_id, task_name, maintenance_required, frequency_days, last_service_date, next_service_date, priority, service_provider_name, spare_part_number, estimated_cost, instructions, notes, is_completed, created_at, updated_at)
         VALUES (?, ?, 'Clean Mesh & Anti-Dust Filter', 1, 90, ?, ?, 'High', 'Daikin Authorised Service', 'DKN-FLT-50', 650.0, 'Power off MCB 02, lift front intake grille, rinse anti-dust mesh under lukewarm water, and dry completely in shade.', 'Due today for seasonal peak performance.', 0, ?, ?)"
    )
    .bind(&daikin_task_id)
    .bind(&daikin_id)
    .bind((now - Duration::days(90)).format("%Y-%m-%d").to_string())
    .bind(&today_str)
    .bind(&now_iso)
    .bind(&now_iso)
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO maintenance_history (id, task_id, asset_id, task_name, completed_date, service_provider_name, cost, notes, created_at)
         VALUES (?, ?, ?, 'Annual Deep Jet-Pump Coil Wash & Gas Check', ?, 'Daikin Authorised Service', 2400.0, 'Outdoor condenser fin wash and refrigerant pressure verified.', ?)"
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&daikin_task_id)
    .bind(&daikin_id)
    .bind((now - Duration::days(90)).format("%Y-%m-%d").to_string())
    .bind(&now_iso)
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO maintenance_tasks (id, asset_id, task_name, maintenance_required, frequency_days, last_service_date, next_service_date, priority, service_provider_name, spare_part_number, estimated_cost, instructions, notes, is_completed, created_at, updated_at)
         VALUES (?, ?, 'Clean Inlet Water Mesh & Drain Trap', 1, 60, ?, ?, 'Medium', 'Bosch Care India', 'BSH-INL-06', 0.0, 'Shut off inlet tap, unscrew rear hose collar, clean sediment mesh, and clear front coin trap.', 'Prevents Error Code E04.', 0, ?, ?)"
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&bosch_washer_id)
    .bind((now - Duration::days(62)).format("%Y-%m-%d").to_string())
    .bind((now - Duration::days(2)).format("%Y-%m-%d").to_string())
    .bind(&now_iso)
    .bind(&now_iso)
    .execute(pool)
    .await?;

    let bosch_doc_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO documents (id, title, file_name, file_path, mime_type, extension, file_size_bytes, category, sha256_hash, page_count, is_missing, relative_path, file_modified_at, integrity_status, observed_sha256, last_verified_at, created_at, updated_at)
         VALUES (?, 'Bosch Serie 6 Washer — User Manual', 'Bosch Serie 6 Washer — User Manual.pdf', 'builtin:bosch_serie6_manual.pdf', 'application/pdf', 'pdf', 245760, 'User Manuals', 'seeded-manual-bosch-serie-6', 36, 0, 'Sample/User Manuals/Bosch Serie 6 Washer — User Manual.pdf', ?, 'builtin', 'seeded-manual-bosch-serie-6', ?, ?, ?)"
    )
    .bind(&bosch_doc_id)
    .bind(&now_iso)
    .bind(&now_iso)
    .bind(&now_iso)
    .bind(&now_iso)
    .execute(pool)
    .await?;

    sqlx::query("INSERT INTO document_asset_links (document_id, asset_id) VALUES (?, ?)")
        .bind(&bosch_doc_id)
        .bind(&bosch_washer_id)
        .execute(pool)
        .await?;

    sqlx::query(
        "INSERT INTO document_pages (id, document_id, page_number, content) VALUES (?, ?, 34, ?)"
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&bosch_doc_id)
    .bind("Error Code E04: Water supply tap closed or inlet filter blocked. Turn off tap and clean mesh filter at the water inlet valve before restarting wash cycle.")
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO paint_records (id, room_name, brand, color_name, hex_code, finish, notes, created_at, updated_at) VALUES
         (?, 'Living Room', 'Asian Paints Royale', 'Warm Alabaster', '#F2EFE9', 'Eggshell', '2 coats over primer, north & west walls', ?, ?),
         (?, 'Master Bedroom', 'Dulux Velvet', 'Mist Slate', '#DCE3E8', 'Matte', 'Accent headboard & side walls', ?, ?)"
    )
    .bind(Uuid::new_v4().to_string()).bind(&now_iso).bind(&now_iso)
    .bind(Uuid::new_v4().to_string()).bind(&now_iso).bind(&now_iso)
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO electrical_breakers (id, breaker_number, circuit_label, amperage, zone, notes, created_at, updated_at) VALUES
         (?, '01', 'Kitchen Heavy Appliances', '32A', 'Main DB', 'Dishwasher, Oven, Espresso & Fridge dedicated spur', ?, ?),
         (?, '02', 'Master AC & Geyser', '20A', 'Main DB', 'Daikin 1.5T Inverter Split AC + 25L Storage Heater', ?, ?),
         (?, '03', 'Living Room & Router UPS', '16A', 'UPS Backup', 'OLED TV, Sonos Arc & Fibernet ONT backed by Luminous UPS', ?, ?)"
    )
    .bind(Uuid::new_v4().to_string()).bind(&now_iso).bind(&now_iso)
    .bind(Uuid::new_v4().to_string()).bind(&now_iso).bind(&now_iso)
    .bind(Uuid::new_v4().to_string()).bind(&now_iso).bind(&now_iso)
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO network_settings (id, router_name, model, ssid, encrypted_password, ip_address, notes, updated_at)
         VALUES (?, 'Primary Mesh Gateway', 'ASUS ZenWiFi XT8 (AX6600)', 'HomeVault_5G_Mesh', 'HV-Mesh@2026#Secure', '192.168.50.1', 'Dual-band Wi-Fi 6 backhaul wired to Living Room & Study', ?)"
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&now_iso)
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO utility_records (id, service_type, provider_name, account_number, support_contact, vendor_phone, notes, created_at, updated_at) VALUES
         (?, 'Fiber Broadband (ISP)', 'ACT Fibernet Gigabit', 'ACT-1092847102', 'support@actcorp.in', '+91 91212 12121', '1 Gbps symmetrical plan, static IP enabled', ?, ?),
         (?, 'Water Purifier AMC', 'AO Smith Authorized Care', 'AOS-AMC-88420', 'customercare@aosmithindia.com', '+91 80 4129 9000', 'Filter cartridge replacement every 6 months', ?, ?)"
    )
    .bind(Uuid::new_v4().to_string()).bind(&now_iso).bind(&now_iso)
    .bind(Uuid::new_v4().to_string()).bind(&now_iso).bind(&now_iso)
    .execute(pool)
    .await?;

    Ok(true)
}

pub const APP_NAME: &str = "ItemCare";
pub const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

pub const APP_DATA_DIR_NAME: &str = "ItemCare";
pub const DEFAULT_STORAGE_DIR_NAME: &str = "VaultFiles";
pub const VAULT_CONFIG_FILENAME: &str = "vault_config.json";
pub const WRITE_PROBE_FILENAME: &str = ".itemcare_write_probe";

pub const DB_FILENAME: &str = "itemcare.db";
pub const LEGACY_DB_FILENAME: &str = "homevault.db";

pub const DOCUMENTS_ROOT_FOLDER: &str = "Documents";
pub const BACKUPS_FOLDER: &str = "Backups";
pub const ATTACHMENTS_FOLDER: &str = "attachments";

pub const BACKUP_EXTENSION: &str = "hvbackup";
pub const DEFAULT_BACKUP_FILENAME: &str = "itemcare-backup.hvbackup";
pub const VALUATION_REPORT_FILENAME: &str = "ItemCare_Valuation_Report.pdf";
pub const VALUATION_REPORT_DOC_TITLE: &str = "ItemCare Insurance Valuation Report";
pub const VALUATION_REPORT_HEADING: &str = "ItemCare — Insurance & Moving Valuation Report";

pub const DEFAULT_OWNER_NAME: &str = "Homeowner";
pub const DEFAULT_RESIDENCE_NAME: &str = "Main Residence";
pub const DEFAULT_CURRENCY: &str = "INR";
pub const DEFAULT_WARRANTY_ALERT_DAYS: &str = "30";
pub const DEFAULT_NETWORK_SSID: &str = "ItemCare_5G_Mesh";

pub const ALLOWED_EXTENSIONS: &[&str] = &["pdf", "jpg", "jpeg", "png", "docx", "xlsx", "txt"];

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

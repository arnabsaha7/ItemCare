PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    icon TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    group_name TEXT NOT NULL DEFAULT 'Main Residence',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_providers (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    specialty TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
    brand TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    serial_number TEXT NOT NULL DEFAULT '',
    product_id TEXT NOT NULL DEFAULT '',
    imei TEXT NOT NULL DEFAULT '',
    qr_barcode TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'in_repair', 'retired')),
    photo_path TEXT,
    serial_photo_path TEXT,
    is_featured INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_name ON assets(name);
CREATE INDEX IF NOT EXISTS idx_assets_serial ON assets(serial_number);
CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location_id);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category_id);

CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY NOT NULL,
    asset_id TEXT NOT NULL UNIQUE REFERENCES assets(id) ON DELETE CASCADE,
    purchase_date TEXT NOT NULL,
    purchase_price REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'INR',
    retailer TEXT NOT NULL DEFAULT '',
    invoice_number TEXT NOT NULL DEFAULT '',
    payment_method TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS warranties (
    id TEXT PRIMARY KEY NOT NULL,
    asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT '',
    start_date TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    duration_months INTEGER NOT NULL DEFAULT 12,
    warranty_type TEXT NOT NULL DEFAULT 'Manufacturer' CHECK (warranty_type IN ('Manufacturer', 'Extended Care', 'AppleCare+', 'Retailer Plan')),
    extended_details TEXT NOT NULL DEFAULT '',
    certificate_document_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_warranties_asset ON warranties(asset_id);
CREATE INDEX IF NOT EXISTS idx_warranties_expiry ON warranties(expiry_date);

CREATE TABLE IF NOT EXISTS maintenance_tasks (
    id TEXT PRIMARY KEY NOT NULL,
    asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    maintenance_required INTEGER NOT NULL DEFAULT 1,
    frequency_days INTEGER NOT NULL DEFAULT 90,
    last_service_date TEXT,
    next_service_date TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    service_provider_id TEXT REFERENCES service_providers(id) ON DELETE SET NULL,
    service_provider_name TEXT NOT NULL DEFAULT '',
    spare_part_number TEXT NOT NULL DEFAULT '',
    estimated_cost REAL NOT NULL DEFAULT 0,
    instructions TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    is_completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_maintenance_asset ON maintenance_tasks(asset_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_next_date ON maintenance_tasks(next_service_date);

CREATE TABLE IF NOT EXISTS maintenance_history (
    id TEXT PRIMARY KEY NOT NULL,
    task_id TEXT REFERENCES maintenance_tasks(id) ON DELETE SET NULL,
    asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    completed_date TEXT NOT NULL,
    service_provider_name TEXT NOT NULL DEFAULT '',
    cost REAL NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_maint_history_asset ON maintenance_history(asset_id);

CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    extension TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT 'Other' CHECK (
        category IN (
            'Invoices',
            'Warranty Certificates',
            'User Manuals',
            'Serial Photos',
            'Service Receipts',
            'Insurance Documents',
            'Property Documents',
            'Other'
        )
    ),
    sha256_hash TEXT NOT NULL DEFAULT '',
    page_count INTEGER NOT NULL DEFAULT 1,
    is_missing INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title);

CREATE TABLE IF NOT EXISTS document_pages (
    id TEXT PRIMARY KEY NOT NULL,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    content TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_doc_pages_doc ON document_pages(document_id);

CREATE TABLE IF NOT EXISTS document_asset_links (
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    PRIMARY KEY (document_id, asset_id)
);

CREATE TABLE IF NOT EXISTS paint_records (
    id TEXT PRIMARY KEY NOT NULL,
    room_name TEXT NOT NULL,
    brand TEXT NOT NULL,
    color_name TEXT NOT NULL DEFAULT '',
    hex_code TEXT NOT NULL,
    finish TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS electrical_breakers (
    id TEXT PRIMARY KEY NOT NULL,
    breaker_number TEXT NOT NULL,
    circuit_label TEXT NOT NULL,
    amperage TEXT NOT NULL,
    zone TEXT NOT NULL DEFAULT 'Main Panel',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS network_settings (
    id TEXT PRIMARY KEY NOT NULL,
    router_name TEXT NOT NULL,
    model TEXT NOT NULL,
    ssid TEXT NOT NULL,
    encrypted_password TEXT NOT NULL,
    ip_address TEXT NOT NULL DEFAULT '192.168.1.1',
    notes TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS utility_records (
    id TEXT PRIMARY KEY NOT NULL,
    service_type TEXT NOT NULL,
    provider_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    support_contact TEXT NOT NULL,
    vendor_phone TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS application_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS backup_history (
    id TEXT PRIMARY KEY NOT NULL,
    archive_name TEXT NOT NULL,
    archive_path TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    asset_count INTEGER NOT NULL,
    document_count INTEGER NOT NULL,
    sha256_checksum TEXT NOT NULL,
    backup_type TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL
);

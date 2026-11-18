use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Location {
    pub id: String,
    pub name: String,
    pub group_name: String,
    pub sort_order: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetRecord {
    pub id: String,
    pub name: String,
    pub category_id: Option<String>,
    pub category_name: String,
    pub location_id: Option<String>,
    pub location_name: String,
    pub brand: String,
    pub model: String,
    pub description: String,
    pub serial_number: String,
    pub product_id: String,
    pub imei: String,
    pub qr_barcode: String,
    pub status: String,
    pub photo_path: Option<String>,
    pub serial_photo_path: Option<String>,
    pub is_featured: bool,
    pub purchase_date: String,
    pub purchase_price: f64,
    pub currency: String,
    pub retailer: String,
    pub invoice_number: String,
    pub payment_method: String,
    pub purchase_notes: String,
    pub total_cost_of_ownership: f64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertAssetInput {
    pub id: Option<String>,
    pub name: String,
    pub category_name: String,
    pub location_name: String,
    pub brand: String,
    pub model: String,
    pub description: String,
    pub serial_number: String,
    pub product_id: String,
    pub imei: String,
    pub qr_barcode: String,
    pub status: String,
    pub photo_path: Option<String>,
    pub serial_photo_path: Option<String>,
    pub purchase_date: String,
    pub purchase_price: f64,
    pub currency: String,
    pub retailer: String,
    pub invoice_number: String,
    pub payment_method: String,
    pub purchase_notes: String,
    // Optional inline warranty on creation/update
    pub warranty_provider: Option<String>,
    pub warranty_start_date: Option<String>,
    pub warranty_expiry_date: Option<String>,
    pub warranty_duration_months: Option<i64>,
    pub warranty_type: Option<String>,
    pub warranty_extended_details: Option<String>,
    // Optional inline maintenance task
    pub maintenance_required: Option<bool>,
    pub maintenance_task_name: Option<String>,
    pub maintenance_frequency_days: Option<i64>,
    pub maintenance_last_service_date: Option<String>,
    pub maintenance_next_service_date: Option<String>,
    pub maintenance_service_provider: Option<String>,
    pub maintenance_spare_part_number: Option<String>,
    pub maintenance_instructions: Option<String>,
}

use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct WarrantyRecord {
    pub id: String,
    pub asset_id: String,
    pub provider: String,
    pub start_date: String,
    pub expiry_date: String,
    pub duration_months: i64,
    pub warranty_type: String,
    pub extended_details: String,
    pub certificate_document_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertWarrantyInput {
    pub id: Option<String>,
    pub asset_id: String,
    pub provider: String,
    pub start_date: String,
    pub expiry_date: String,
    pub duration_months: i64,
    pub warranty_type: String,
    pub extended_details: String,
    pub certificate_document_id: Option<String>,
}

use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PaintRecord {
    pub id: String,
    pub room_name: String,
    pub brand: String,
    pub color_name: String,
    pub hex_code: String,
    pub finish: String,
    pub notes: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ElectricalBreaker {
    pub id: String,
    pub breaker_number: String,
    pub circuit_label: String,
    pub amperage: String,
    pub zone: String,
    pub notes: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct NetworkSetting {
    pub id: String,
    pub router_name: String,
    pub model: String,
    pub ssid: String,
    pub encrypted_password: String,
    pub ip_address: String,
    pub notes: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct UtilityRecord {
    pub id: String,
    pub service_type: String,
    pub provider_name: String,
    pub account_number: String,
    pub support_contact: String,
    pub vendor_phone: String,
    pub notes: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct BackupHistoryRecord {
    pub id: String,
    pub archive_name: String,
    pub archive_path: String,
    pub size_bytes: i64,
    pub asset_count: i64,
    pub document_count: i64,
    pub sha256_checksum: String,
    pub backup_type: String,
    pub created_at: String,
}

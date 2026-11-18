use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct DocumentRecord {
    pub id: String,
    pub title: String,
    pub file_name: String,
    pub file_path: String,
    pub mime_type: String,
    pub extension: String,
    pub file_size_bytes: i64,
    pub category: String,
    pub sha256_hash: String,
    pub page_count: i64,
    pub is_missing: bool,
    pub relative_path: String,
    pub file_modified_at: String,
    pub integrity_status: String,
    pub observed_sha256: String,
    pub last_verified_at: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentWithLinks {
    #[serde(flatten)]
    pub document: DocumentRecord,
    pub linked_asset_ids: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportDocumentInput {
    pub source_path: String,
    pub title: Option<String>,
    pub category: String,
    pub linked_asset_ids: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexDocumentPageInput {
    pub document_id: String,
    pub page_number: i64,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrityReport {
    pub total_checked: usize,
    pub verified_count: usize,
    pub modified_count: usize,
    pub missing_count: usize,
    pub checked_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub kind: String, // "asset" | "document" | "manual_page"
    pub id: String,
    pub title: String,
    pub subtitle: String,
    pub snippet: String,
    pub asset_id: Option<String>,
    pub document_id: Option<String>,
    pub page_number: Option<i64>,
}

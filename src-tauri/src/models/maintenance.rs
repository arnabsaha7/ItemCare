use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct MaintenanceTaskRecord {
    pub id: String,
    pub asset_id: String,
    pub task_name: String,
    pub maintenance_required: bool,
    pub frequency_days: i64,
    pub last_service_date: Option<String>,
    pub next_service_date: String,
    pub priority: String,
    pub service_provider_id: Option<String>,
    pub service_provider_name: String,
    pub spare_part_number: String,
    pub estimated_cost: f64,
    pub instructions: String,
    pub notes: String,
    pub is_completed: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct MaintenanceHistoryRecord {
    pub id: String,
    pub task_id: Option<String>,
    pub asset_id: String,
    pub task_name: String,
    pub completed_date: String,
    pub service_provider_name: String,
    pub cost: f64,
    pub notes: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertMaintenanceTaskInput {
    pub id: Option<String>,
    pub asset_id: String,
    pub task_name: String,
    pub maintenance_required: bool,
    pub frequency_days: i64,
    pub last_service_date: Option<String>,
    pub next_service_date: String,
    pub priority: String,
    pub service_provider_name: String,
    pub spare_part_number: String,
    pub estimated_cost: f64,
    pub instructions: String,
    pub notes: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteMaintenanceInput {
    pub task_id: String,
    pub completed_date: String,
    pub cost: f64,
    pub service_provider_name: Option<String>,
    pub notes: String,
}

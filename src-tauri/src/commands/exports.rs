use crate::commands::assets::list_assets;
use crate::commands::documents::DOCUMENT_SELECT_COLS;
use crate::commands::maintenance::list_maintenance_history;
use crate::database::AppState;
use crate::errors::{AppError, AppResult};
use crate::models::document::DocumentRecord;
use crate::services::export_service::{
    create_encrypted_insurance_pack, InsuranceExportRequest, InsuranceExportResult,
};
use crate::services::file_service::resolve_authorized_document_path;
use tauri::State;

#[tauri::command]
pub async fn export_insurance_package(
    state: State<'_, AppState>,
    request: InsuranceExportRequest,
) -> AppResult<InsuranceExportResult> {
    let all_assets = list_assets(state.clone()).await?;
    let filtered_assets: Vec<_> = match &request.room_filter {
        Some(room) if !room.is_empty() && room != "All" => all_assets
            .into_iter()
            .filter(|a| a.location_name == *room)
            .collect(),
        _ => all_assets,
    };

    let sql = format!("SELECT {} FROM documents", DOCUMENT_SELECT_COLS);
    let mut docs = sqlx::query_as::<_, DocumentRecord>(&sql)
        .fetch_all(&state.pool)
        .await?;

    let storage_dir = state
        .storage_dir
        .read()
        .map_err(|_| AppError::Internal("Storage lock poisoned".into()))?
        .clone();
    for doc in &mut docs {
        if !doc.file_path.starts_with("builtin:") {
            if let Ok(resolved) = resolve_authorized_document_path(
                &storage_dir,
                &state.vault_dir,
                &doc.file_path,
                &doc.relative_path,
            ) {
                doc.file_path = resolved.to_string_lossy().to_string();
            }
        }
    }

    let history = list_maintenance_history(state.clone()).await?;
    create_encrypted_insurance_pack(&request, &filtered_assets, &docs, &history)
}

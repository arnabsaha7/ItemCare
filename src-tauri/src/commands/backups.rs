use crate::constants::DEFAULT_BACKUP_FILENAME;
use crate::database::AppState;
use crate::errors::{AppError, AppResult};
use crate::models::property::BackupHistoryRecord;
use crate::services::backup_service::{
    create_vault_backup, inspect_backup_archive, restore_backup_archive, BackupManifest,
};
use chrono::Utc;
use std::path::Path;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn list_backup_history(
    state: State<'_, AppState>,
) -> AppResult<Vec<BackupHistoryRecord>> {
    let rows = sqlx::query_as::<_, BackupHistoryRecord>(
        "SELECT id, archive_name, archive_path, size_bytes, asset_count, document_count, sha256_checksum, backup_type, created_at
         FROM backup_history ORDER BY created_at DESC"
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(rows)
}

#[tauri::command]
pub async fn create_backup(
    state: State<'_, AppState>,
    destination_path: String,
) -> AppResult<BackupHistoryRecord> {
    let (asset_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM assets")
        .fetch_one(&state.pool)
        .await?;
    let (document_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM documents")
        .fetch_one(&state.pool)
        .await?;

    let storage_dir = state
        .storage_dir
        .read()
        .map_err(|_| AppError::Internal("Storage lock poisoned".into()))?
        .clone();

    let dest = Path::new(&destination_path);
    let (size_bytes, checksum) = create_vault_backup(
        &state.vault_dir,
        &storage_dir,
        &state.db_path,
        dest,
        asset_count,
        document_count,
    )?;

    let archive_name = dest
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(DEFAULT_BACKUP_FILENAME)
        .to_string();

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO backup_history (id, archive_name, archive_path, size_bytes, asset_count, document_count, sha256_checksum, backup_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?)"
    )
    .bind(&id)
    .bind(&archive_name)
    .bind(&destination_path)
    .bind(size_bytes as i64)
    .bind(asset_count)
    .bind(document_count)
    .bind(&checksum)
    .bind(&now)
    .execute(&state.pool)
    .await?;

    Ok(BackupHistoryRecord {
        id,
        archive_name,
        archive_path: destination_path,
        size_bytes: size_bytes as i64,
        asset_count,
        document_count,
        sha256_checksum: checksum,
        backup_type: "manual".into(),
        created_at: now,
    })
}

#[tauri::command]
pub async fn validate_backup_file(archive_path: String) -> AppResult<BackupManifest> {
    inspect_backup_archive(Path::new(&archive_path))
}

#[tauri::command]
pub async fn restore_from_backup(
    state: State<'_, AppState>,
    archive_path: String,
) -> AppResult<BackupManifest> {
    let storage_dir = state
        .storage_dir
        .read()
        .map_err(|_| AppError::Internal("Storage lock poisoned".into()))?
        .clone();
    restore_backup_archive(
        &state.vault_dir,
        &storage_dir,
        &state.db_path,
        Path::new(&archive_path),
    )
}
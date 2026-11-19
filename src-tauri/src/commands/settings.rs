use crate::commands::documents::DOCUMENT_SELECT_COLS;
use crate::constants::WRITE_PROBE_FILENAME;
use crate::database::{
    ensure_storage_structure, load_sample_data as db_load_sample_data, save_storage_config,
    AppState,
};
use crate::errors::{AppError, AppResult};
use crate::models::document::DocumentRecord;
use crate::services::file_service::{
    compute_sha256, is_safe_relative_path, resolve_authorized_document_path,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultInfo {
    pub vault_directory: String,
    pub database_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageConfig {
    pub storage_path: String,
    pub default_storage_path: String,
    pub is_custom: bool,
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> AppResult<HashMap<String, String>> {
    let rows = sqlx::query("SELECT key, value FROM application_settings")
        .fetch_all(&state.pool)
        .await?;
    let mut map = HashMap::new();
    for row in rows {
        map.insert(row.get("key"), row.get("value"));
    }
    Ok(map)
}

#[tauri::command]
pub async fn set_setting(state: State<'_, AppState>, key: String, value: String) -> AppResult<()> {
    sqlx::query(
        "INSERT INTO application_settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    )
    .bind(key)
    .bind(value)
    .bind(Utc::now().to_rfc3339())
    .execute(&state.pool)
    .await?;
    Ok(())
}

#[tauri::command]
pub async fn get_vault_info(state: State<'_, AppState>) -> AppResult<VaultInfo> {
    Ok(VaultInfo {
        vault_directory: state.vault_dir.to_string_lossy().to_string(),
        database_path: state.db_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub async fn get_storage_config(state: State<'_, AppState>) -> AppResult<StorageConfig> {
    let active = state
        .storage_dir
        .read()
        .map_err(|_| AppError::Internal("Storage lock poisoned".into()))?
        .clone();
    Ok(StorageConfig {
        storage_path: active.to_string_lossy().to_string(),
        default_storage_path: state.default_storage_dir.to_string_lossy().to_string(),
        is_custom: active != state.default_storage_dir,
    })
}

#[tauri::command]
pub async fn set_storage_location(
    state: State<'_, AppState>,
    new_path: String,
    migrate_existing: bool,
) -> AppResult<StorageConfig> {
    let trimmed = new_path.trim();
    let target_dir = if trimmed.is_empty() {
        state.default_storage_dir.clone()
    } else {
        PathBuf::from(trimmed)
    };

    ensure_storage_structure(&target_dir)?;

    let probe_path = target_dir.join(WRITE_PROBE_FILENAME);
    std::fs::write(&probe_path, b"ok").map_err(|e| {
        AppError::Validation(format!(
            "Selected storage folder is not writable ({}): {}",
            target_dir.display(),
            e
        ))
    })?;
    let _ = std::fs::remove_file(&probe_path);

    let old_dir = state
        .storage_dir
        .read()
        .map_err(|_| AppError::Internal("Storage lock poisoned".into()))?
        .clone();

    if migrate_existing && old_dir != target_dir {
        let sql = format!("SELECT {} FROM documents", DOCUMENT_SELECT_COLS);
        let docs = sqlx::query_as::<_, DocumentRecord>(&sql)
            .fetch_all(&state.pool)
            .await?;

        let mut moved_paths: Vec<(String, String, String, PathBuf)> = Vec::new();
        for doc in docs {
            if doc.file_path.starts_with("builtin:") {
                continue;
            }
            let src = resolve_authorized_document_path(
                &old_dir,
                &state.vault_dir,
                &doc.file_path,
                &doc.relative_path,
            )?;
            if !src.exists() || !src.is_file() {
                continue;
            }
            let rel = if is_safe_relative_path(&doc.relative_path) {
                doc.relative_path.clone()
            } else {
                let fname = src
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or(&doc.file_name);
                format!("Documents/Other/{}", fname)
            };
            let dest = target_dir.join(&rel);
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let bytes = std::fs::read(&src)?;
            let copied_sha = compute_sha256(&bytes);
            std::fs::write(&dest, &bytes)?;
            let verify_bytes = std::fs::read(&dest)?;
            if compute_sha256(&verify_bytes) != copied_sha {
                return Err(AppError::Internal(format!(
                    "Migration integrity verification failed for {}",
                    doc.file_name
                )));
            }
            moved_paths.push((doc.id, dest.to_string_lossy().to_string(), rel, src));
        }

        let mut tx = state.pool.begin().await?;
        for (doc_id, new_file_path, rel, _) in &moved_paths {
            sqlx::query("UPDATE documents SET file_path = ?, relative_path = ? WHERE id = ?")
                .bind(new_file_path)
                .bind(rel)
                .bind(doc_id)
                .execute(&mut *tx)
                .await?;
        }
        tx.commit().await?;

        for (_, _, _, old_src) in moved_paths {
            let _ = std::fs::remove_file(old_src);
        }
    }

    save_storage_config(&state.vault_dir, &target_dir)?;
    {
        let mut guard = state
            .storage_dir
            .write()
            .map_err(|_| AppError::Internal("Storage lock poisoned".into()))?;
        *guard = target_dir.clone();
    }

    Ok(StorageConfig {
        storage_path: target_dir.to_string_lossy().to_string(),
        default_storage_path: state.default_storage_dir.to_string_lossy().to_string(),
        is_custom: target_dir != state.default_storage_dir,
    })
}

#[tauri::command]
pub async fn load_sample_data(state: State<'_, AppState>) -> AppResult<bool> {
    db_load_sample_data(&state.pool).await
}
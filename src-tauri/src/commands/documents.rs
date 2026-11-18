use crate::database::AppState;
use crate::errors::{AppError, AppResult};
use crate::models::document::{
    DocumentRecord, DocumentWithLinks, ImportDocumentInput, IndexDocumentPageInput, IntegrityReport,
};
use crate::services::file_service::{
    category_folder_name, compute_sha256, inspect_file_integrity, is_safe_relative_path,
    read_file_mtime_iso, resolve_authorized_document_path, validate_and_copy_attachment,
};
use chrono::Utc;
use std::path::Path;
use tauri::State;
use uuid::Uuid;

pub const DOCUMENT_SELECT_COLS: &str = "id, title, file_name, file_path, mime_type, extension, file_size_bytes, category, sha256_hash, page_count, is_missing, relative_path, file_modified_at, integrity_status, observed_sha256, last_verified_at, created_at, updated_at";

fn current_storage_dir(state: &AppState) -> AppResult<std::path::PathBuf> {
    state
        .storage_dir
        .read()
        .map(|g| g.clone())
        .map_err(|_| AppError::Internal("Storage directory lock poisoned".into()))
}

#[tauri::command]
pub async fn list_documents(state: State<'_, AppState>) -> AppResult<Vec<DocumentWithLinks>> {
    let sql = format!(
        "SELECT {} FROM documents ORDER BY created_at DESC",
        DOCUMENT_SELECT_COLS
    );
    let docs = sqlx::query_as::<_, DocumentRecord>(&sql)
        .fetch_all(&state.pool)
        .await?;

    let storage_dir = current_storage_dir(&state)?;
    let now_iso = Utc::now().to_rfc3339();
    let mut result = Vec::with_capacity(docs.len());

    for mut doc in docs {
        if !doc.file_path.starts_with("builtin:") {
            let resolved = resolve_authorized_document_path(
                &storage_dir,
                &state.vault_dir,
                &doc.file_path,
                &doc.relative_path,
            );
            if let Ok(target_path) = resolved {
                let check = inspect_file_integrity(
                    &target_path,
                    &doc.sha256_hash,
                    doc.file_size_bytes,
                    &doc.file_modified_at,
                    false,
                );
                let now_missing = check.status == "missing";
                if check.status != doc.integrity_status
                    || now_missing != doc.is_missing
                    || check.observed_sha256 != doc.observed_sha256
                {
                    doc.integrity_status = check.status.clone();
                    doc.is_missing = now_missing;
                    doc.observed_sha256 = check.observed_sha256.clone();
                    doc.last_verified_at = now_iso.clone();
                    let _ = sqlx::query(
                        "UPDATE documents SET is_missing = ?, integrity_status = ?, observed_sha256 = ?, last_verified_at = ? WHERE id = ?"
                    )
                    .bind(if now_missing { 1 } else { 0 })
                    .bind(&doc.integrity_status)
                    .bind(&doc.observed_sha256)
                    .bind(&doc.last_verified_at)
                    .bind(&doc.id)
                    .execute(&state.pool)
                    .await;
                }
            }
        }

        let links: Vec<(String,)> =
            sqlx::query_as("SELECT asset_id FROM document_asset_links WHERE document_id = ?")
                .bind(&doc.id)
                .fetch_all(&state.pool)
                .await?;
        result.push(DocumentWithLinks {
            document: doc,
            linked_asset_ids: links.into_iter().map(|(id,)| id).collect(),
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn import_document(
    state: State<'_, AppState>,
    input: ImportDocumentInput,
) -> AppResult<DocumentWithLinks> {
    let storage_dir = current_storage_dir(&state)?;
    let stored =
        validate_and_copy_attachment(Path::new(&input.source_path), &storage_dir, &input.category)?;

    let doc_id = Uuid::new_v4().to_string();
    let now_iso = Utc::now().to_rfc3339();
    let title = input
        .title
        .filter(|t| !t.trim().is_empty())
        .unwrap_or_else(|| {
            Path::new(&stored.original_name)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or(&stored.original_name)
                .to_string()
        });

    let mut tx = state.pool.begin().await?;

    sqlx::query(
        "INSERT INTO documents (id, title, file_name, file_path, mime_type, extension, file_size_bytes, category, sha256_hash, page_count, is_missing, relative_path, file_modified_at, integrity_status, observed_sha256, last_verified_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, 'verified', ?, ?, ?, ?)"
    )
    .bind(&doc_id)
    .bind(&title)
    .bind(&stored.original_name)
    .bind(stored.dest_path.to_string_lossy().to_string())
    .bind(&stored.mime_type)
    .bind(&stored.extension)
    .bind(stored.size_bytes)
    .bind(&input.category)
    .bind(&stored.sha256_hash)
    .bind(&stored.relative_path)
    .bind(&stored.file_modified_at)
    .bind(&stored.sha256_hash)
    .bind(&now_iso)
    .bind(&now_iso)
    .bind(&now_iso)
    .execute(&mut *tx)
    .await?;

    for asset_id in &input.linked_asset_ids {
        sqlx::query(
            "INSERT OR IGNORE INTO document_asset_links (document_id, asset_id) VALUES (?, ?)",
        )
        .bind(&doc_id)
        .bind(asset_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    let sql = format!(
        "SELECT {} FROM documents WHERE id = ?",
        DOCUMENT_SELECT_COLS
    );
    let doc = sqlx::query_as::<_, DocumentRecord>(&sql)
        .bind(&doc_id)
        .fetch_one(&state.pool)
        .await?;

    Ok(DocumentWithLinks {
        document: doc,
        linked_asset_ids: input.linked_asset_ids,
    })
}

#[tauri::command]
pub async fn read_document_bytes(
    state: State<'_, AppState>,
    document_id: String,
) -> AppResult<Vec<u8>> {
    let sql = format!(
        "SELECT {} FROM documents WHERE id = ?",
        DOCUMENT_SELECT_COLS
    );
    let doc = sqlx::query_as::<_, DocumentRecord>(&sql)
        .bind(&document_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Document record not found.".into()))?;

    if doc.file_path.starts_with("builtin:") {
        return Err(AppError::Validation(
            "Built-in sample documents are served directly by the frontend.".into(),
        ));
    }

    let storage_dir = current_storage_dir(&state)?;
    let resolved_path = resolve_authorized_document_path(
        &storage_dir,
        &state.vault_dir,
        &doc.file_path,
        &doc.relative_path,
    )?;

    if !resolved_path.exists() || !resolved_path.is_file() {
        let now_iso = Utc::now().to_rfc3339();
        let _ = sqlx::query(
            "UPDATE documents SET is_missing = 1, integrity_status = 'missing', observed_sha256 = '', last_verified_at = ? WHERE id = ?"
        )
        .bind(&now_iso)
        .bind(&doc.id)
        .execute(&state.pool)
        .await;
        return Err(AppError::NotFound(format!(
            "File could not be found in storage: {}",
            resolved_path.display()
        )));
    }

    let bytes = std::fs::read(&resolved_path)?;
    let actual_sha = compute_sha256(&bytes);
    let now_iso = Utc::now().to_rfc3339();
    let status = if doc.sha256_hash.is_empty() || actual_sha == doc.sha256_hash {
        "verified"
    } else {
        "modified"
    };

    if status != doc.integrity_status || actual_sha != doc.observed_sha256 || doc.is_missing {
        let _ = sqlx::query(
            "UPDATE documents SET is_missing = 0, integrity_status = ?, observed_sha256 = ?, last_verified_at = ? WHERE id = ?"
        )
        .bind(status)
        .bind(&actual_sha)
        .bind(&now_iso)
        .bind(&doc.id)
        .execute(&state.pool)
        .await;
    }

    Ok(bytes)
}

#[tauri::command]
pub async fn verify_documents_integrity(state: State<'_, AppState>) -> AppResult<IntegrityReport> {
    let sql = format!("SELECT {} FROM documents", DOCUMENT_SELECT_COLS);
    let docs = sqlx::query_as::<_, DocumentRecord>(&sql)
        .fetch_all(&state.pool)
        .await?;

    let storage_dir = current_storage_dir(&state)?;
    let checked_at = Utc::now().to_rfc3339();
    let mut total_checked = 0usize;
    let mut verified_count = 0usize;
    let mut modified_count = 0usize;
    let mut missing_count = 0usize;

    for doc in docs {
        if doc.file_path.starts_with("builtin:") {
            continue;
        }
        total_checked += 1;
        let path = resolve_authorized_document_path(
            &storage_dir,
            &state.vault_dir,
            &doc.file_path,
            &doc.relative_path,
        )?;
        let check = inspect_file_integrity(
            &path,
            &doc.sha256_hash,
            doc.file_size_bytes,
            &doc.file_modified_at,
            true,
        );
        match check.status.as_str() {
            "verified" => verified_count += 1,
            "modified" => modified_count += 1,
            _ => missing_count += 1,
        }
        sqlx::query(
            "UPDATE documents SET is_missing = ?, integrity_status = ?, observed_sha256 = ?, last_verified_at = ? WHERE id = ?"
        )
        .bind(if check.status == "missing" { 1 } else { 0 })
        .bind(&check.status)
        .bind(&check.observed_sha256)
        .bind(&checked_at)
        .bind(&doc.id)
        .execute(&state.pool)
        .await?;
    }

    Ok(IntegrityReport {
        total_checked,
        verified_count,
        modified_count,
        missing_count,
        checked_at,
    })
}

#[tauri::command]
pub async fn accept_modified_document(
    state: State<'_, AppState>,
    document_id: String,
) -> AppResult<DocumentWithLinks> {
    let sql = format!(
        "SELECT {} FROM documents WHERE id = ?",
        DOCUMENT_SELECT_COLS
    );
    let doc = sqlx::query_as::<_, DocumentRecord>(&sql)
        .bind(&document_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Document not found.".into()))?;

    let storage_dir = current_storage_dir(&state)?;
    let path = resolve_authorized_document_path(
        &storage_dir,
        &state.vault_dir,
        &doc.file_path,
        &doc.relative_path,
    )?;
    if !path.exists() || !path.is_file() {
        return Err(AppError::NotFound(
            "Cannot accept missing document file.".into(),
        ));
    }

    let bytes = std::fs::read(&path)?;
    let new_sha = compute_sha256(&bytes);
    let new_size = bytes.len() as i64;
    let new_mtime = read_file_mtime_iso(&path);
    let now_iso = Utc::now().to_rfc3339();

    sqlx::query(
        "UPDATE documents SET sha256_hash = ?, observed_sha256 = ?, file_size_bytes = ?, file_modified_at = ?, integrity_status = 'verified', is_missing = 0, last_verified_at = ?, updated_at = ? WHERE id = ?"
    )
    .bind(&new_sha)
    .bind(&new_sha)
    .bind(new_size)
    .bind(&new_mtime)
    .bind(&now_iso)
    .bind(&now_iso)
    .bind(&document_id)
    .execute(&state.pool)
    .await?;

    let updated = sqlx::query_as::<_, DocumentRecord>(&sql)
        .bind(&document_id)
        .fetch_one(&state.pool)
        .await?;
    let links: Vec<(String,)> =
        sqlx::query_as("SELECT asset_id FROM document_asset_links WHERE document_id = ?")
            .bind(&document_id)
            .fetch_all(&state.pool)
            .await?;

    Ok(DocumentWithLinks {
        document: updated,
        linked_asset_ids: links.into_iter().map(|(id,)| id).collect(),
    })
}

#[tauri::command]
pub async fn index_document_pages(
    state: State<'_, AppState>,
    pages: Vec<IndexDocumentPageInput>,
) -> AppResult<()> {
    if pages.is_empty() {
        return Ok(());
    }
    let doc_id = pages[0].document_id.clone();
    let mut tx = state.pool.begin().await?;

    sqlx::query("DELETE FROM document_pages WHERE document_id = ?")
        .bind(&doc_id)
        .execute(&mut *tx)
        .await?;

    for page in &pages {
        sqlx::query("INSERT INTO document_pages (id, document_id, page_number, content) VALUES (?, ?, ?, ?)")
            .bind(Uuid::new_v4().to_string())
            .bind(&page.document_id)
            .bind(page.page_number)
            .bind(&page.content)
            .execute(&mut *tx)
            .await?;
    }

    sqlx::query("UPDATE documents SET page_count = ?, updated_at = ? WHERE id = ?")
        .bind(pages.len() as i64)
        .bind(Utc::now().to_rfc3339())
        .bind(&doc_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(())
}

#[tauri::command]
pub async fn update_document_metadata(
    state: State<'_, AppState>,
    document_id: String,
    title: String,
    category: String,
    linked_asset_ids: Vec<String>,
) -> AppResult<()> {
    if title.trim().is_empty() {
        return Err(AppError::Validation(
            "Document title cannot be empty.".into(),
        ));
    }

    let sql = format!(
        "SELECT {} FROM documents WHERE id = ?",
        DOCUMENT_SELECT_COLS
    );
    let existing = sqlx::query_as::<_, DocumentRecord>(&sql)
        .bind(&document_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Document not found.".into()))?;

    let storage_dir = current_storage_dir(&state)?;
    let mut next_file_path = existing.file_path.clone();
    let mut next_rel_path = existing.relative_path.clone();

    // Relocate file cleanly into the matching category folder if category changed on a managed document
    if existing.category != category
        && !existing.file_path.starts_with("builtin:")
        && is_safe_relative_path(&existing.relative_path)
    {
        if let Ok(old_path) = resolve_authorized_document_path(
            &storage_dir,
            &state.vault_dir,
            &existing.file_path,
            &existing.relative_path,
        ) {
            if old_path.exists() {
                let parts: Vec<&str> = existing.relative_path.split('/').collect();
                if parts.len() >= 4 && parts[0] == "Documents" {
                    let year_seg = parts[2];
                    let file_seg = parts[3..].join("/");
                    let new_rel = format!(
                        "Documents/{}/{}/{}",
                        category_folder_name(&category),
                        year_seg,
                        file_seg
                    );
                    let new_path = storage_dir.join(&new_rel);
                    if let Some(parent) = new_path.parent() {
                        let _ = std::fs::create_dir_all(parent);
                    }
                    if std::fs::rename(&old_path, &new_path).is_ok() {
                        next_rel_path = new_rel;
                        next_file_path = new_path.to_string_lossy().to_string();
                    }
                }
            }
        }
    }

    let mut tx = state.pool.begin().await?;
    sqlx::query(
        "UPDATE documents SET title = ?, category = ?, file_path = ?, relative_path = ?, updated_at = ? WHERE id = ?"
    )
    .bind(title.trim())
    .bind(&category)
    .bind(&next_file_path)
    .bind(&next_rel_path)
    .bind(Utc::now().to_rfc3339())
    .bind(&document_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query("DELETE FROM document_asset_links WHERE document_id = ?")
        .bind(&document_id)
        .execute(&mut *tx)
        .await?;

    for asset_id in linked_asset_ids {
        sqlx::query(
            "INSERT OR IGNORE INTO document_asset_links (document_id, asset_id) VALUES (?, ?)",
        )
        .bind(&document_id)
        .bind(asset_id)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(())
}

#[tauri::command]
pub async fn delete_document(state: State<'_, AppState>, document_id: String) -> AppResult<()> {
    let sql = format!(
        "SELECT {} FROM documents WHERE id = ?",
        DOCUMENT_SELECT_COLS
    );
    let doc = sqlx::query_as::<_, DocumentRecord>(&sql)
        .bind(&document_id)
        .fetch_optional(&state.pool)
        .await?;

    if let Some(d) = doc {
        if !d.file_path.starts_with("builtin:") {
            let storage_dir = current_storage_dir(&state)?;
            if let Ok(p) = resolve_authorized_document_path(
                &storage_dir,
                &state.vault_dir,
                &d.file_path,
                &d.relative_path,
            ) {
                if p.exists() {
                    let _ = std::fs::remove_file(p);
                }
            }
        }
    }

    sqlx::query("DELETE FROM documents WHERE id = ?")
        .bind(&document_id)
        .execute(&state.pool)
        .await?;
    Ok(())
}

use crate::database::AppState;
use crate::errors::{AppError, AppResult};
use crate::models::warranty::{UpsertWarrantyInput, WarrantyRecord};
use chrono::Utc;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn list_warranties(state: State<'_, AppState>) -> AppResult<Vec<WarrantyRecord>> {
    let rows = sqlx::query_as::<_, WarrantyRecord>(
        "SELECT id, asset_id, provider, start_date, expiry_date, duration_months, warranty_type, extended_details, certificate_document_id, created_at, updated_at
         FROM warranties ORDER BY expiry_date ASC"
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(rows)
}

#[tauri::command]
pub async fn upsert_warranty(
    state: State<'_, AppState>,
    input: UpsertWarrantyInput,
) -> AppResult<WarrantyRecord> {
    if input.provider.trim().is_empty() {
        return Err(AppError::Validation("Warranty provider is required.".into()));
    }
    let now_iso = Utc::now().to_rfc3339();
    let id = input.id.clone().unwrap_or_else(|| Uuid::new_v4().to_string());

    if input.id.is_some() {
        sqlx::query(
            "UPDATE warranties SET provider = ?, start_date = ?, expiry_date = ?, duration_months = ?, warranty_type = ?, extended_details = ?, certificate_document_id = ?, updated_at = ?
             WHERE id = ?"
        )
        .bind(&input.provider)
        .bind(&input.start_date)
        .bind(&input.expiry_date)
        .bind(input.duration_months)
        .bind(&input.warranty_type)
        .bind(&input.extended_details)
        .bind(&input.certificate_document_id)
        .bind(&now_iso)
        .bind(&id)
        .execute(&state.pool)
        .await?;
    } else {
        sqlx::query(
            "INSERT INTO warranties (id, asset_id, provider, start_date, expiry_date, duration_months, warranty_type, extended_details, certificate_document_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(&input.asset_id)
        .bind(&input.provider)
        .bind(&input.start_date)
        .bind(&input.expiry_date)
        .bind(input.duration_months)
        .bind(&input.warranty_type)
        .bind(&input.extended_details)
        .bind(&input.certificate_document_id)
        .bind(&now_iso)
        .bind(&now_iso)
        .execute(&state.pool)
        .await?;
    }

    let record = sqlx::query_as::<_, WarrantyRecord>(
        "SELECT id, asset_id, provider, start_date, expiry_date, duration_months, warranty_type, extended_details, certificate_document_id, created_at, updated_at
         FROM warranties WHERE id = ?"
    )
    .bind(&id)
    .fetch_one(&state.pool)
    .await?;

    Ok(record)
}

#[tauri::command]
pub async fn delete_warranty(state: State<'_, AppState>, warranty_id: String) -> AppResult<()> {
    sqlx::query("DELETE FROM warranties WHERE id = ?")
        .bind(&warranty_id)
        .execute(&state.pool)
        .await?;
    Ok(())
}

use crate::database::AppState;
use crate::errors::{AppError, AppResult};
use crate::models::maintenance::{
    CompleteMaintenanceInput, MaintenanceHistoryRecord, MaintenanceTaskRecord,
    UpsertMaintenanceTaskInput,
};
use chrono::{Duration, NaiveDate, Utc};
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn list_maintenance_tasks(
    state: State<'_, AppState>,
) -> AppResult<Vec<MaintenanceTaskRecord>> {
    let rows = sqlx::query_as::<_, MaintenanceTaskRecord>(
        "SELECT id, asset_id, task_name, maintenance_required, frequency_days, last_service_date, next_service_date,
                priority, service_provider_id, service_provider_name, spare_part_number, estimated_cost, instructions,
                notes, is_completed, created_at, updated_at
         FROM maintenance_tasks ORDER BY next_service_date ASC"
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(rows)
}

#[tauri::command]
pub async fn list_maintenance_history(
    state: State<'_, AppState>,
) -> AppResult<Vec<MaintenanceHistoryRecord>> {
    let rows = sqlx::query_as::<_, MaintenanceHistoryRecord>(
        "SELECT id, task_id, asset_id, task_name, completed_date, service_provider_name, cost, notes, created_at
         FROM maintenance_history ORDER BY completed_date DESC, created_at DESC"
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(rows)
}

#[tauri::command]
pub async fn upsert_maintenance_task(
    state: State<'_, AppState>,
    input: UpsertMaintenanceTaskInput,
) -> AppResult<MaintenanceTaskRecord> {
    if input.task_name.trim().is_empty() {
        return Err(AppError::Validation("Task name is required.".into()));
    }
    let now_iso = Utc::now().to_rfc3339();
    let id = input
        .id
        .clone()
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    if input.id.is_some() {
        sqlx::query(
            "UPDATE maintenance_tasks SET task_name = ?, maintenance_required = ?, frequency_days = ?, last_service_date = ?,
                    next_service_date = ?, priority = ?, service_provider_name = ?, spare_part_number = ?, estimated_cost = ?,
                    instructions = ?, notes = ?, updated_at = ?
             WHERE id = ?"
        )
        .bind(&input.task_name)
        .bind(input.maintenance_required)
        .bind(input.frequency_days)
        .bind(&input.last_service_date)
        .bind(&input.next_service_date)
        .bind(&input.priority)
        .bind(&input.service_provider_name)
        .bind(&input.spare_part_number)
        .bind(input.estimated_cost)
        .bind(&input.instructions)
        .bind(&input.notes)
        .bind(&now_iso)
        .bind(&id)
        .execute(&state.pool)
        .await?;
    } else {
        sqlx::query(
            "INSERT INTO maintenance_tasks (id, asset_id, task_name, maintenance_required, frequency_days, last_service_date, next_service_date,
                    priority, service_provider_name, spare_part_number, estimated_cost, instructions, notes, is_completed, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)"
        )
        .bind(&id)
        .bind(&input.asset_id)
        .bind(&input.task_name)
        .bind(input.maintenance_required)
        .bind(input.frequency_days)
        .bind(&input.last_service_date)
        .bind(&input.next_service_date)
        .bind(&input.priority)
        .bind(&input.service_provider_name)
        .bind(&input.spare_part_number)
        .bind(input.estimated_cost)
        .bind(&input.instructions)
        .bind(&input.notes)
        .bind(&now_iso)
        .bind(&now_iso)
        .execute(&state.pool)
        .await?;
    }

    let task = sqlx::query_as::<_, MaintenanceTaskRecord>(
        "SELECT id, asset_id, task_name, maintenance_required, frequency_days, last_service_date, next_service_date,
                priority, service_provider_id, service_provider_name, spare_part_number, estimated_cost, instructions,
                notes, is_completed, created_at, updated_at
         FROM maintenance_tasks WHERE id = ?"
    )
    .bind(&id)
    .fetch_one(&state.pool)
    .await?;

    Ok(task)
}

#[tauri::command]
pub async fn complete_maintenance_task(
    state: State<'_, AppState>,
    input: CompleteMaintenanceInput,
) -> AppResult<MaintenanceTaskRecord> {
    let mut tx = state.pool.begin().await?;

    let task = sqlx::query_as::<_, MaintenanceTaskRecord>(
        "SELECT id, asset_id, task_name, maintenance_required, frequency_days, last_service_date, next_service_date,
                priority, service_provider_id, service_provider_name, spare_part_number, estimated_cost, instructions,
                notes, is_completed, created_at, updated_at
         FROM maintenance_tasks WHERE id = ?"
    )
    .bind(&input.task_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Maintenance task not found".into()))?;

    let completed_naive = NaiveDate::parse_from_str(&input.completed_date, "%Y-%m-%d")
        .unwrap_or_else(|_| Utc::now().date_naive());
    let next_naive = completed_naive + Duration::days(task.frequency_days.max(1));
    let next_str = next_naive.format("%Y-%m-%d").to_string();
    let now_iso = Utc::now().to_rfc3339();

    let provider = input
        .service_provider_name
        .unwrap_or_else(|| task.service_provider_name.clone());

    sqlx::query(
        "INSERT INTO maintenance_history (id, task_id, asset_id, task_name, completed_date, service_provider_name, cost, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&task.id)
    .bind(&task.asset_id)
    .bind(&task.task_name)
    .bind(&input.completed_date)
    .bind(&provider)
    .bind(input.cost)
    .bind(&input.notes)
    .bind(&now_iso)
    .execute(&mut *tx)
    .await?;

    let is_recurring = task.frequency_days > 0;
    sqlx::query(
        "UPDATE maintenance_tasks SET last_service_date = ?, next_service_date = ?, is_completed = ?, updated_at = ? WHERE id = ?"
    )
    .bind(&input.completed_date)
    .bind(&next_str)
    .bind(if is_recurring { 0 } else { 1 })
    .bind(&now_iso)
    .bind(&task.id)
    .execute(&mut *tx)
    .await?;

    let updated = sqlx::query_as::<_, MaintenanceTaskRecord>(
        "SELECT id, asset_id, task_name, maintenance_required, frequency_days, last_service_date, next_service_date,
                priority, service_provider_id, service_provider_name, spare_part_number, estimated_cost, instructions,
                notes, is_completed, created_at, updated_at
         FROM maintenance_tasks WHERE id = ?"
    )
    .bind(&task.id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(updated)
}

#[tauri::command]
pub async fn delete_maintenance_task(state: State<'_, AppState>, task_id: String) -> AppResult<()> {
    sqlx::query("DELETE FROM maintenance_tasks WHERE id = ?")
        .bind(&task_id)
        .execute(&state.pool)
        .await?;
    Ok(())
}

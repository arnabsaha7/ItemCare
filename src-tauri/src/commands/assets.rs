use crate::database::AppState;
use crate::errors::{AppError, AppResult};
use crate::models::asset::{AssetRecord, Category, Location, UpsertAssetInput};
use chrono::Utc;
use sqlx::Row;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn list_assets(state: State<'_, AppState>) -> AppResult<Vec<AssetRecord>> {
    let rows = sqlx::query(
        "SELECT a.id, a.name, a.category_id, COALESCE(c.name, 'Uncategorized') AS category_name,
                a.location_id, COALESCE(l.name, 'Unassigned') AS location_name,
                a.brand, a.model, a.description, a.serial_number, a.product_id, a.imei, a.qr_barcode,
                a.status, a.photo_path, a.serial_photo_path, a.is_featured,
                COALESCE(p.purchase_date, '') AS purchase_date,
                COALESCE(p.purchase_price, 0.0) AS purchase_price,
                COALESCE(p.currency, 'INR') AS currency,
                COALESCE(p.retailer, '') AS retailer,
                COALESCE(p.invoice_number, '') AS invoice_number,
                COALESCE(p.payment_method, '') AS payment_method,
                COALESCE(p.notes, '') AS purchase_notes,
                COALESCE(p.purchase_price, 0.0) + COALESCE((SELECT SUM(mh.cost) FROM maintenance_history mh WHERE mh.asset_id = a.id), 0.0) AS total_cost_of_ownership,
                a.created_at, a.updated_at
         FROM assets a
         LEFT JOIN categories c ON a.category_id = c.id
         LEFT JOIN locations l ON a.location_id = l.id
         LEFT JOIN purchases p ON p.asset_id = a.id
         ORDER BY a.is_featured DESC, a.created_at DESC"
    )
    .fetch_all(&state.pool)
    .await?;

    let assets = rows
        .into_iter()
        .map(|r| AssetRecord {
            id: r.get("id"),
            name: r.get("name"),
            category_id: r.get("category_id"),
            category_name: r.get("category_name"),
            location_id: r.get("location_id"),
            location_name: r.get("location_name"),
            brand: r.get("brand"),
            model: r.get("model"),
            description: r.get("description"),
            serial_number: r.get("serial_number"),
            product_id: r.get("product_id"),
            imei: r.get("imei"),
            qr_barcode: r.get("qr_barcode"),
            status: r.get("status"),
            photo_path: r.get("photo_path"),
            serial_photo_path: r.get("serial_photo_path"),
            is_featured: r.get::<i64, _>("is_featured") == 1,
            purchase_date: r.get("purchase_date"),
            purchase_price: r.get("purchase_price"),
            currency: r.get("currency"),
            retailer: r.get("retailer"),
            invoice_number: r.get("invoice_number"),
            payment_method: r.get("payment_method"),
            purchase_notes: r.get("purchase_notes"),
            total_cost_of_ownership: r.get("total_cost_of_ownership"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
        })
        .collect();

    Ok(assets)
}

#[tauri::command]
pub async fn list_categories(state: State<'_, AppState>) -> AppResult<Vec<Category>> {
    let items = sqlx::query_as::<_, Category>(
        "SELECT id, name, icon, sort_order, created_at FROM categories ORDER BY sort_order ASC, name ASC"
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(items)
}

#[tauri::command]
pub async fn list_locations(state: State<'_, AppState>) -> AppResult<Vec<Location>> {
    let items = sqlx::query_as::<_, Location>(
        "SELECT id, name, group_name, sort_order, created_at FROM locations ORDER BY sort_order ASC, name ASC"
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(items)
}

#[tauri::command]
pub async fn upsert_asset(state: State<'_, AppState>, input: UpsertAssetInput) -> AppResult<String> {
    if input.name.trim().is_empty() {
        return Err(AppError::Validation("Asset name is required.".into()));
    }
    if input.purchase_price < 0.0 {
        return Err(AppError::Validation("Purchase price cannot be negative.".into()));
    }

    let now_iso = Utc::now().to_rfc3339();
    let asset_id = input.id.clone().unwrap_or_else(|| Uuid::new_v4().to_string());

    let mut tx = state.pool.begin().await?;

    // Resolve or create category
    let cat_id: String = match sqlx::query_as::<_, (String,)>("SELECT id FROM categories WHERE name = ?")
        .bind(&input.category_name)
        .fetch_optional(&mut *tx)
        .await?
    {
        Some((id,)) => id,
        None => {
            let id = Uuid::new_v4().to_string();
            sqlx::query("INSERT INTO categories (id, name, icon, sort_order, created_at) VALUES (?, ?, 'box', 99, ?)")
                .bind(&id)
                .bind(&input.category_name)
                .bind(&now_iso)
                .execute(&mut *tx)
                .await?;
            id
        }
    };

    // Resolve or create location
    let loc_id: String = match sqlx::query_as::<_, (String,)>("SELECT id FROM locations WHERE name = ?")
        .bind(&input.location_name)
        .fetch_optional(&mut *tx)
        .await?
    {
        Some((id,)) => id,
        None => {
            let id = Uuid::new_v4().to_string();
            sqlx::query("INSERT INTO locations (id, name, group_name, sort_order, created_at) VALUES (?, ?, 'Main Residence', 99, ?)")
                .bind(&id)
                .bind(&input.location_name)
                .bind(&now_iso)
                .execute(&mut *tx)
                .await?;
            id
        }
    };

    if input.id.is_some() {
        sqlx::query(
            "UPDATE assets SET name = ?, category_id = ?, location_id = ?, brand = ?, model = ?, description = ?,
                    serial_number = ?, product_id = ?, imei = ?, qr_barcode = ?, status = ?, photo_path = ?,
                    serial_photo_path = ?, updated_at = ?
             WHERE id = ?"
        )
        .bind(input.name.trim())
        .bind(&cat_id)
        .bind(&loc_id)
        .bind(&input.brand)
        .bind(&input.model)
        .bind(&input.description)
        .bind(&input.serial_number)
        .bind(&input.product_id)
        .bind(&input.imei)
        .bind(&input.qr_barcode)
        .bind(&input.status)
        .bind(&input.photo_path)
        .bind(&input.serial_photo_path)
        .bind(&now_iso)
        .bind(&asset_id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            "INSERT INTO purchases (id, asset_id, purchase_date, purchase_price, currency, retailer, invoice_number, payment_method, notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(asset_id) DO UPDATE SET
               purchase_date = excluded.purchase_date,
               purchase_price = excluded.purchase_price,
               currency = excluded.currency,
               retailer = excluded.retailer,
               invoice_number = excluded.invoice_number,
               payment_method = excluded.payment_method,
               notes = excluded.notes,
               updated_at = excluded.updated_at"
        )
        .bind(Uuid::new_v4().to_string())
        .bind(&asset_id)
        .bind(&input.purchase_date)
        .bind(input.purchase_price)
        .bind(&input.currency)
        .bind(&input.retailer)
        .bind(&input.invoice_number)
        .bind(&input.payment_method)
        .bind(&input.purchase_notes)
        .bind(&now_iso)
        .bind(&now_iso)
        .execute(&mut *tx)
        .await?;
    } else {
        sqlx::query(
            "INSERT INTO assets (id, name, category_id, location_id, brand, model, description, serial_number, product_id, imei, qr_barcode, status, photo_path, serial_photo_path, is_featured, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)"
        )
        .bind(&asset_id)
        .bind(input.name.trim())
        .bind(&cat_id)
        .bind(&loc_id)
        .bind(&input.brand)
        .bind(&input.model)
        .bind(&input.description)
        .bind(&input.serial_number)
        .bind(&input.product_id)
        .bind(&input.imei)
        .bind(&input.qr_barcode)
        .bind(&input.status)
        .bind(&input.photo_path)
        .bind(&input.serial_photo_path)
        .bind(&now_iso)
        .bind(&now_iso)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            "INSERT INTO purchases (id, asset_id, purchase_date, purchase_price, currency, retailer, invoice_number, payment_method, notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(Uuid::new_v4().to_string())
        .bind(&asset_id)
        .bind(&input.purchase_date)
        .bind(input.purchase_price)
        .bind(&input.currency)
        .bind(&input.retailer)
        .bind(&input.invoice_number)
        .bind(&input.payment_method)
        .bind(&input.purchase_notes)
        .bind(&now_iso)
        .bind(&now_iso)
        .execute(&mut *tx)
        .await?;

        if let (Some(provider), Some(start), Some(expiry)) = (
            input.warranty_provider.filter(|s| !s.trim().is_empty()),
            input.warranty_start_date,
            input.warranty_expiry_date,
        ) {
            sqlx::query(
                "INSERT INTO warranties (id, asset_id, provider, start_date, expiry_date, duration_months, warranty_type, extended_details, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(Uuid::new_v4().to_string())
            .bind(&asset_id)
            .bind(provider)
            .bind(start)
            .bind(expiry)
            .bind(input.warranty_duration_months.unwrap_or(12))
            .bind(input.warranty_type.unwrap_or_else(|| "Manufacturer".into()))
            .bind(input.warranty_extended_details.unwrap_or_default())
            .bind(&now_iso)
            .bind(&now_iso)
            .execute(&mut *tx)
            .await?;
        }

        if input.maintenance_required.unwrap_or(false) {
            if let (Some(task_name), Some(next_date)) = (
                input.maintenance_task_name.filter(|s| !s.trim().is_empty()),
                input.maintenance_next_service_date,
            ) {
                sqlx::query(
                    "INSERT INTO maintenance_tasks (id, asset_id, task_name, maintenance_required, frequency_days, last_service_date, next_service_date, priority, service_provider_name, spare_part_number, estimated_cost, instructions, notes, is_completed, created_at, updated_at)
                     VALUES (?, ?, ?, 1, ?, ?, ?, 'Medium', ?, ?, 0.0, ?, '', 0, ?, ?)"
                )
                .bind(Uuid::new_v4().to_string())
                .bind(&asset_id)
                .bind(task_name)
                .bind(input.maintenance_frequency_days.unwrap_or(90))
                .bind(input.maintenance_last_service_date)
                .bind(next_date)
                .bind(input.maintenance_service_provider.unwrap_or_default())
                .bind(input.maintenance_spare_part_number.unwrap_or_default())
                .bind(input.maintenance_instructions.unwrap_or_default())
                .bind(&now_iso)
                .bind(&now_iso)
                .execute(&mut *tx)
                .await?;
            }
        }
    }

    tx.commit().await?;
    Ok(asset_id)
}

#[tauri::command]
pub async fn delete_asset(state: State<'_, AppState>, asset_id: String) -> AppResult<()> {
    let result = sqlx::query("DELETE FROM assets WHERE id = ?")
        .bind(&asset_id)
        .execute(&state.pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Asset {} not found", asset_id)));
    }
    Ok(())
}

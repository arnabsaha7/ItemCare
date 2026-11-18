use crate::database::AppState;
use crate::errors::AppResult;
use crate::models::property::{ElectricalBreaker, NetworkSetting, PaintRecord, UtilityRecord};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PropertySpecsBundle {
    pub paint_records: Vec<PaintRecord>,
    pub breakers: Vec<ElectricalBreaker>,
    pub network: Vec<NetworkSetting>,
    pub utilities: Vec<UtilityRecord>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertPaintInput {
    pub id: Option<String>,
    pub room_name: String,
    pub brand: String,
    pub color_name: String,
    pub hex_code: String,
    pub finish: String,
    pub notes: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertBreakerInput {
    pub id: Option<String>,
    pub breaker_number: String,
    pub circuit_label: String,
    pub amperage: String,
    pub zone: String,
    pub notes: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertNetworkInput {
    pub id: Option<String>,
    pub router_name: String,
    pub model: String,
    pub ssid: String,
    pub encrypted_password: String,
    pub ip_address: String,
    pub notes: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertUtilityInput {
    pub id: Option<String>,
    pub service_type: String,
    pub provider_name: String,
    pub account_number: String,
    pub support_contact: String,
    pub vendor_phone: String,
    pub notes: String,
}

#[tauri::command]
pub async fn get_property_specs(state: State<'_, AppState>) -> AppResult<PropertySpecsBundle> {
    let paint_records = sqlx::query_as::<_, PaintRecord>(
        "SELECT id, room_name, brand, color_name, hex_code, finish, notes, created_at, updated_at FROM paint_records ORDER BY room_name ASC"
    )
    .fetch_all(&state.pool)
    .await?;

    let breakers = sqlx::query_as::<_, ElectricalBreaker>(
        "SELECT id, breaker_number, circuit_label, amperage, zone, notes, created_at, updated_at FROM electrical_breakers ORDER BY breaker_number ASC"
    )
    .fetch_all(&state.pool)
    .await?;

    let network = sqlx::query_as::<_, NetworkSetting>(
        "SELECT id, router_name, model, ssid, encrypted_password, ip_address, notes, updated_at FROM network_settings"
    )
    .fetch_all(&state.pool)
    .await?;

    let utilities = sqlx::query_as::<_, UtilityRecord>(
        "SELECT id, service_type, provider_name, account_number, support_contact, vendor_phone, notes, created_at, updated_at FROM utility_records ORDER BY service_type ASC"
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(PropertySpecsBundle {
        paint_records,
        breakers,
        network,
        utilities,
    })
}

#[tauri::command]
pub async fn upsert_paint_record(state: State<'_, AppState>, input: UpsertPaintInput) -> AppResult<()> {
    let now = Utc::now().to_rfc3339();
    if let Some(id) = input.id {
        sqlx::query("UPDATE paint_records SET room_name = ?, brand = ?, color_name = ?, hex_code = ?, finish = ?, notes = ?, updated_at = ? WHERE id = ?")
            .bind(input.room_name).bind(input.brand).bind(input.color_name).bind(input.hex_code).bind(input.finish).bind(input.notes).bind(&now).bind(id)
            .execute(&state.pool).await?;
    } else {
        sqlx::query("INSERT INTO paint_records (id, room_name, brand, color_name, hex_code, finish, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(Uuid::new_v4().to_string()).bind(input.room_name).bind(input.brand).bind(input.color_name).bind(input.hex_code).bind(input.finish).bind(input.notes).bind(&now).bind(&now)
            .execute(&state.pool).await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_paint_record(state: State<'_, AppState>, id: String) -> AppResult<()> {
    sqlx::query("DELETE FROM paint_records WHERE id = ?").bind(id).execute(&state.pool).await?;
    Ok(())
}

#[tauri::command]
pub async fn upsert_electrical_breaker(state: State<'_, AppState>, input: UpsertBreakerInput) -> AppResult<()> {
    let now = Utc::now().to_rfc3339();
    if let Some(id) = input.id {
        sqlx::query("UPDATE electrical_breakers SET breaker_number = ?, circuit_label = ?, amperage = ?, zone = ?, notes = ?, updated_at = ? WHERE id = ?")
            .bind(input.breaker_number).bind(input.circuit_label).bind(input.amperage).bind(input.zone).bind(input.notes).bind(&now).bind(id)
            .execute(&state.pool).await?;
    } else {
        sqlx::query("INSERT INTO electrical_breakers (id, breaker_number, circuit_label, amperage, zone, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(Uuid::new_v4().to_string()).bind(input.breaker_number).bind(input.circuit_label).bind(input.amperage).bind(input.zone).bind(input.notes).bind(&now).bind(&now)
            .execute(&state.pool).await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_electrical_breaker(state: State<'_, AppState>, id: String) -> AppResult<()> {
    sqlx::query("DELETE FROM electrical_breakers WHERE id = ?").bind(id).execute(&state.pool).await?;
    Ok(())
}

#[tauri::command]
pub async fn upsert_network_setting(state: State<'_, AppState>, input: UpsertNetworkInput) -> AppResult<()> {
    let now = Utc::now().to_rfc3339();
    if let Some(id) = input.id {
        sqlx::query("UPDATE network_settings SET router_name = ?, model = ?, ssid = ?, encrypted_password = ?, ip_address = ?, notes = ?, updated_at = ? WHERE id = ?")
            .bind(input.router_name).bind(input.model).bind(input.ssid).bind(input.encrypted_password).bind(input.ip_address).bind(input.notes).bind(&now).bind(id)
            .execute(&state.pool).await?;
    } else {
        sqlx::query("INSERT INTO network_settings (id, router_name, model, ssid, encrypted_password, ip_address, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(Uuid::new_v4().to_string()).bind(input.router_name).bind(input.model).bind(input.ssid).bind(input.encrypted_password).bind(input.ip_address).bind(input.notes).bind(&now)
            .execute(&state.pool).await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn upsert_utility_record(state: State<'_, AppState>, input: UpsertUtilityInput) -> AppResult<()> {
    let now = Utc::now().to_rfc3339();
    if let Some(id) = input.id {
        sqlx::query("UPDATE utility_records SET service_type = ?, provider_name = ?, account_number = ?, support_contact = ?, vendor_phone = ?, notes = ?, updated_at = ? WHERE id = ?")
            .bind(input.service_type).bind(input.provider_name).bind(input.account_number).bind(input.support_contact).bind(input.vendor_phone).bind(input.notes).bind(&now).bind(id)
            .execute(&state.pool).await?;
    } else {
        sqlx::query("INSERT INTO utility_records (id, service_type, provider_name, account_number, support_contact, vendor_phone, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(Uuid::new_v4().to_string()).bind(input.service_type).bind(input.provider_name).bind(input.account_number).bind(input.support_contact).bind(input.vendor_phone).bind(input.notes).bind(&now).bind(&now)
            .execute(&state.pool).await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_utility_record(state: State<'_, AppState>, id: String) -> AppResult<()> {
    sqlx::query("DELETE FROM utility_records WHERE id = ?").bind(id).execute(&state.pool).await?;
    Ok(())
}

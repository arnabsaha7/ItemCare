pub mod commands;
pub mod database;
pub mod errors;
pub mod models;
pub mod services;

use database::init_database;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve OS application data directory");

            let state = tauri::async_runtime::block_on(init_database(&app_data_dir))
                .expect("Failed to initialize HomeVault SQLite database");

            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::assets::list_assets,
            commands::assets::list_categories,
            commands::assets::list_locations,
            commands::assets::upsert_asset,
            commands::assets::delete_asset,
            commands::warranties::list_warranties,
            commands::warranties::upsert_warranty,
            commands::warranties::delete_warranty,
            commands::maintenance::list_maintenance_tasks,
            commands::maintenance::list_maintenance_history,
            commands::maintenance::upsert_maintenance_task,
            commands::maintenance::complete_maintenance_task,
            commands::maintenance::delete_maintenance_task,
            commands::documents::list_documents,
            commands::documents::import_document,
            commands::documents::read_document_bytes,
            commands::documents::verify_documents_integrity,
            commands::documents::accept_modified_document,
            commands::documents::index_document_pages,
            commands::documents::update_document_metadata,
            commands::documents::delete_document,
            commands::property::get_property_specs,
            commands::property::upsert_paint_record,
            commands::property::delete_paint_record,
            commands::property::upsert_electrical_breaker,
            commands::property::delete_electrical_breaker,
            commands::property::upsert_network_setting,
            commands::property::upsert_utility_record,
            commands::property::delete_utility_record,
            commands::exports::export_insurance_package,
            commands::backups::list_backup_history,
            commands::backups::create_backup,
            commands::backups::validate_backup_file,
            commands::backups::restore_from_backup,
            commands::settings::get_settings,
            commands::settings::set_setting,
            commands::settings::get_vault_info,
            commands::settings::get_storage_config,
            commands::settings::set_storage_location,
            commands::settings::load_sample_data,
            commands::search::global_search,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running HomeVault Tauri application");
}

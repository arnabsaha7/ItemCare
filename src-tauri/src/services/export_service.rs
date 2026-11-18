use crate::errors::{AppError, AppResult};
use crate::models::asset::AssetRecord;
use crate::models::document::DocumentRecord;
use crate::models::maintenance::MaintenanceHistoryRecord;
use crate::services::pdf_service::generate_valuation_pdf_bytes;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Write;
use std::path::Path;
use zip::unstable::write::FileOptionsExt;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InsuranceExportRequest {
    pub destination_path: String,
    pub room_filter: Option<String>,
    pub include_receipts: bool,
    pub include_serial_photos: bool,
    pub include_warranties: bool,
    pub include_manuals: bool,
    pub include_maintenance_history: bool,
    pub include_valuation_pdf: bool,
    pub password: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InsuranceExportResult {
    pub archive_path: String,
    pub asset_count: usize,
    pub total_valuation: f64,
    pub file_size_bytes: u64,
    pub encrypted: bool,
}

pub fn create_encrypted_insurance_pack(
    request: &InsuranceExportRequest,
    assets: &[AssetRecord],
    documents: &[DocumentRecord],
    history: &[MaintenanceHistoryRecord],
) -> AppResult<InsuranceExportResult> {
    if request.password.trim().len() < 6 {
        return Err(AppError::Validation(
            "Encryption password must be at least 6 characters.".into(),
        ));
    }

    let dest = Path::new(&request.destination_path);
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let file = File::create(dest)?;
    let mut zip = ZipWriter::new(file);

    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .with_aes_encryption(zip::AesMode::Aes256, request.password.trim());

    // 1. CSV Inventory
    let mut csv = String::from("ID,Name,Category,Location,Brand,Model,SerialNumber,PurchaseDate,PurchasePriceINR,Retailer,TCO_INR\n");
    for a in assets {
        csv.push_str(&format!(
            "\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",{:.2},\"{}\",{:.2}\n",
            a.id,
            a.name.replace('"', "\"\""),
            a.category_name,
            a.location_name,
            a.brand,
            a.model,
            a.serial_number,
            a.purchase_date,
            a.purchase_price,
            a.retailer.replace('"', "\"\""),
            a.total_cost_of_ownership
        ));
    }
    zip.start_file("inventory.csv", options)?;
    zip.write_all(csv.as_bytes())?;

    // 2. Valuation PDF
    if request.include_valuation_pdf {
        let scope = request
            .room_filter
            .as_deref()
            .unwrap_or("Entire Home");
        let pdf_bytes = generate_valuation_pdf_bytes(assets, scope)?;
        zip.start_file("HomeVault_Valuation_Report.pdf", options)?;
        zip.write_all(&pdf_bytes)?;
    }

    // 3. Maintenance History CSV
    if request.include_maintenance_history {
        let mut mcsv = String::from("AssetID,TaskName,CompletedDate,ServiceProvider,CostINR,Notes\n");
        for h in history {
            mcsv.push_str(&format!(
                "\"{}\",\"{}\",\"{}\",\"{}\",{:.2},\"{}\"\n",
                h.asset_id,
                h.task_name.replace('"', "\"\""),
                h.completed_date,
                h.service_provider_name.replace('"', "\"\""),
                h.cost,
                h.notes.replace('"', "\"\"")
            ));
        }
        zip.start_file("maintenance_history.csv", options)?;
        zip.write_all(mcsv.as_bytes())?;
    }

    // 4. Vault attachments filtered by category selection
    for doc in documents {
        let include = match doc.category.as_str() {
            "Invoices" | "Service Receipts" => request.include_receipts,
            "Serial Photos" => request.include_serial_photos,
            "Warranty Certificates" => request.include_warranties,
            "User Manuals" => request.include_manuals,
            _ => true,
        };
        if !include || doc.file_path.starts_with("builtin:") {
            continue;
        }
        let path = Path::new(&doc.file_path);
        if path.exists() && path.is_file() {
            if let Ok(bytes) = std::fs::read(path) {
                let entry_name = format!("attachments/{}/{}", doc.category, doc.file_name);
                zip.start_file(entry_name, options)?;
                zip.write_all(&bytes)?;
            }
        }
    }

    zip.finish()?;

    let meta = std::fs::metadata(dest)?;
    let total_valuation: f64 = assets.iter().map(|a| a.purchase_price).sum();

    Ok(InsuranceExportResult {
        archive_path: request.destination_path.clone(),
        asset_count: assets.len(),
        total_valuation,
        file_size_bytes: meta.len(),
        encrypted: true,
    })
}

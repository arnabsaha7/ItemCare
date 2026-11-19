use crate::constants::{APP_VERSION, DB_FILENAME};
use crate::errors::{AppError, AppResult};
use crate::services::file_service::is_safe_relative_path;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::Path;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupManifest {
    pub app_version: String,
    pub created_at: String,
    pub asset_count: i64,
    pub document_count: i64,
    pub db_sha256: String,
}

fn add_dir_recursive(
    zip: &mut ZipWriter<File>,
    root_dir: &Path,
    current_dir: &Path,
    zip_prefix: &str,
    options: SimpleFileOptions,
) -> AppResult<()> {
    if !current_dir.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(current_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            add_dir_recursive(zip, root_dir, &path, zip_prefix, options)?;
        } else if path.is_file() {
            if let Ok(rel) = path.strip_prefix(root_dir) {
                let rel_posix = rel.to_string_lossy().replace('\\', "/");
                let bytes = fs::read(&path)?;
                zip.start_file(format!("{}/{}", zip_prefix, rel_posix), options)?;
                zip.write_all(&bytes)?;
            }
        }
    }
    Ok(())
}

pub fn create_vault_backup(
    vault_dir: &Path,
    storage_dir: &Path,
    db_path: &Path,
    destination_path: &Path,
    asset_count: i64,
    document_count: i64,
) -> AppResult<(u64, String)> {
    if let Some(parent) = destination_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let db_bytes = fs::read(db_path)?;
    let mut hasher = Sha256::new();
    hasher.update(&db_bytes);
    let db_sha256 = hex::encode(hasher.finalize());

    let manifest = BackupManifest {
        app_version: APP_VERSION.into(),
        created_at: Utc::now().to_rfc3339(),
        asset_count,
        document_count,
        db_sha256: db_sha256.clone(),
    };

    let out_file = File::create(destination_path)?;
    let mut zip = ZipWriter::new(out_file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    zip.start_file("manifest.json", options)?;
    zip.write_all(serde_json::to_string_pretty(&manifest)?.as_bytes())?;

    zip.start_file(DB_FILENAME, options)?;
    zip.write_all(&db_bytes)?;

    let docs_dir = storage_dir.join("Documents");
    add_dir_recursive(&mut zip, &docs_dir, &docs_dir, "Documents", options)?;

    let attachments_dir = vault_dir.join("attachments");
    add_dir_recursive(
        &mut zip,
        &attachments_dir,
        &attachments_dir,
        "attachments",
        options,
    )?;

    zip.finish()?;

    let archive_bytes = fs::read(destination_path)?;
    let mut archive_hasher = Sha256::new();
    archive_hasher.update(&archive_bytes);
    let archive_checksum = hex::encode(archive_hasher.finalize());

    Ok((archive_bytes.len() as u64, archive_checksum))
}

pub fn inspect_backup_archive(archive_path: &Path) -> AppResult<BackupManifest> {
    let file = File::open(archive_path)?;
    let mut archive = ZipArchive::new(file)?;

    let mut manifest_file = archive.by_name("manifest.json").map_err(|_| {
        AppError::Validation("Invalid ItemCare backup: missing manifest.json".into())
    })?;
    let mut manifest_str = String::new();
    manifest_file.read_to_string(&mut manifest_str)?;
    let manifest: BackupManifest = serde_json::from_str(&manifest_str)?;

    drop(manifest_file);

    let mut db_file = archive.by_name(DB_FILENAME).map_err(|_| {
        AppError::Validation(format!("Invalid ItemCare backup: missing {}", DB_FILENAME))
    })?;
    let mut db_bytes = Vec::new();
    db_file.read_to_end(&mut db_bytes)?;

    let mut hasher = Sha256::new();
    hasher.update(&db_bytes);
    let actual_hash = hex::encode(hasher.finalize());
    if actual_hash != manifest.db_sha256 {
        return Err(AppError::Validation(
            "Backup checksum verification failed — archive may be corrupted.".into(),
        ));
    }

    Ok(manifest)
}

pub fn restore_backup_archive(
    vault_dir: &Path,
    storage_dir: &Path,
    db_path: &Path,
    archive_path: &Path,
) -> AppResult<BackupManifest> {
    let manifest = inspect_backup_archive(archive_path)?;

    let safety_dir = storage_dir.join("Backups");
    fs::create_dir_all(&safety_dir)?;
    let safety_path = safety_dir.join(format!(
        "pre_restore_{}.hvbackup",
        Utc::now().format("%Y%m%d_%H%M%S")
    ));
    let _ = create_vault_backup(vault_dir, storage_dir, db_path, &safety_path, 0, 0);

    let file = File::open(archive_path)?;
    let mut archive = ZipArchive::new(file)?;

    let mut db_bytes = Vec::new();
    {
        let mut db_entry = archive.by_name(DB_FILENAME)?;
        db_entry.read_to_end(&mut db_bytes)?;
    }

    let tmp_db = vault_dir.join(format!("{}.restore_tmp", DB_FILENAME));
    fs::write(&tmp_db, &db_bytes)?;
    fs::rename(&tmp_db, db_path)?;

    let docs_dir = storage_dir.join("Documents");
    let attachments_dir = vault_dir.join("attachments");
    fs::create_dir_all(&docs_dir)?;
    fs::create_dir_all(&attachments_dir)?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        if entry.is_dir() {
            continue;
        }
        let name = entry.name().to_string();
        if let Some(rel) = name.strip_prefix("Documents/") {
            if is_safe_relative_path(rel) {
                let target = docs_dir.join(rel);
                if let Some(parent) = target.parent() {
                    fs::create_dir_all(parent)?;
                }
                let mut content = Vec::new();
                entry.read_to_end(&mut content)?;
                fs::write(target, content)?;
            }
        } else if let Some(rel) = name.strip_prefix("attachments/") {
            if is_safe_relative_path(rel) {
                let target = attachments_dir.join(rel);
                if let Some(parent) = target.parent() {
                    fs::create_dir_all(parent)?;
                }
                let mut content = Vec::new();
                entry.read_to_end(&mut content)?;
                fs::write(target, content)?;
            }
        }
    }

    Ok(manifest)
}
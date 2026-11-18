use crate::database::CATEGORY_FOLDERS;
use crate::errors::{AppError, AppResult};
use chrono::{DateTime, Datelike, Utc};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Component, Path, PathBuf};
use uuid::Uuid;

const ALLOWED_EXTENSIONS: &[&str] = &["pdf", "jpg", "jpeg", "png", "docx", "xlsx", "txt"];

pub struct StoredAttachmentMetadata {
    pub original_name: String,
    pub dest_path: PathBuf,
    pub relative_path: String,
    pub mime_type: String,
    pub extension: String,
    pub size_bytes: i64,
    pub sha256_hash: String,
    pub file_modified_at: String,
}

pub struct FileIntegrityCheck {
    pub status: String, // "verified" | "modified" | "missing"
    pub observed_sha256: String,
    pub observed_size_bytes: i64,
    pub observed_modified_at: String,
}

pub fn category_folder_name(category: &str) -> &'static str {
    CATEGORY_FOLDERS
        .iter()
        .copied()
        .find(|c| *c == category)
        .unwrap_or("Other")
}

pub fn compute_sha256(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
}

pub fn read_file_mtime_iso(path: &Path) -> String {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .map(|st| {
            let dt: DateTime<Utc> = st.into();
            dt.to_rfc3339()
        })
        .unwrap_or_else(|_| Utc::now().to_rfc3339())
}

pub fn build_structured_relative_path(
    category: &str,
    original_name: &str,
    short_id: &str,
    year: i32,
) -> String {
    let folder = category_folder_name(category);
    let safe_name = sanitize_filename(original_name);
    format!("Documents/{}/{}/{}_{}", folder, year, short_id, safe_name)
}

pub fn validate_and_copy_attachment(
    source_path: &Path,
    storage_dir: &Path,
    category: &str,
) -> AppResult<StoredAttachmentMetadata> {
    if !source_path.exists() || !source_path.is_file() {
        return Err(AppError::NotFound(format!(
            "Source file not found: {}",
            source_path.display()
        )));
    }

    let extension = source_path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .ok_or_else(|| AppError::Validation("File has no extension".into()))?;

    if !ALLOWED_EXTENSIONS.contains(&extension.as_str()) {
        return Err(AppError::Validation(format!(
            "Unsupported file extension .{}",
            extension
        )));
    }

    let original_name = source_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("document")
        .to_string();

    let short_id = Uuid::new_v4().simple().to_string();
    let short_prefix = &short_id[..8];
    let year = Utc::now().year();
    let relative_path = build_structured_relative_path(category, &original_name, short_prefix, year);

    let dest_path = storage_dir.join(&relative_path);
    if let Some(parent) = dest_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let bytes = fs::read(source_path)?;
    let size_bytes = bytes.len() as i64;
    let sha256_hash = compute_sha256(&bytes);

    fs::write(&dest_path, &bytes)?;
    let file_modified_at = read_file_mtime_iso(&dest_path);

    let mime_type = mime_for_ext(&extension).to_string();
    Ok(StoredAttachmentMetadata {
        original_name,
        dest_path,
        relative_path,
        mime_type,
        extension,
        size_bytes,
        sha256_hash,
        file_modified_at,
    })
}

pub fn is_safe_relative_path(rel: &str) -> bool {
    !rel.is_empty()
        && Path::new(rel)
            .components()
            .all(|c| matches!(c, Component::Normal(_)))
}

/// Resolves the managed file path safely inside the authorized storage root or legacy vault dir.
pub fn resolve_authorized_document_path(
    storage_dir: &Path,
    vault_dir: &Path,
    file_path: &str,
    relative_path: &str,
) -> AppResult<PathBuf> {
    if is_safe_relative_path(relative_path) {
        let candidate = storage_dir.join(relative_path);
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    let direct = PathBuf::from(file_path);
    if let (Ok(canon_file), Ok(canon_storage)) = (direct.canonicalize(), storage_dir.canonicalize()) {
        if canon_file.starts_with(&canon_storage) {
            return Ok(canon_file);
        }
    }
    if let (Ok(canon_file), Ok(canon_vault)) = (direct.canonicalize(), vault_dir.canonicalize()) {
        if canon_file.starts_with(&canon_vault) {
            return Ok(canon_file);
        }
    }

    if !direct.exists() {
        return Ok(direct);
    }

    Err(AppError::Validation(
        "Access denied: document path resolves outside the authorized HomeVault storage folder."
            .into(),
    ))
}

pub fn inspect_file_integrity(
    path: &Path,
    expected_sha256: &str,
    expected_size: i64,
    expected_mtime: &str,
    force_hash: bool,
) -> FileIntegrityCheck {
    if !path.exists() || !path.is_file() {
        return FileIntegrityCheck {
            status: "missing".into(),
            observed_sha256: String::new(),
            observed_size_bytes: 0,
            observed_modified_at: String::new(),
        };
    }

    let meta = match fs::metadata(path) {
        Ok(m) => m,
        Err(_) => {
            return FileIntegrityCheck {
                status: "missing".into(),
                observed_sha256: String::new(),
                observed_size_bytes: 0,
                observed_modified_at: String::new(),
            };
        }
    };

    let observed_size = meta.len() as i64;
    let observed_mtime = read_file_mtime_iso(path);

    // Fast path for list_documents when size and mtime match and not forcing hash
    if !force_hash
        && expected_size > 0
        && observed_size == expected_size
        && !expected_mtime.is_empty()
        && observed_mtime == expected_mtime
    {
        return FileIntegrityCheck {
            status: "verified".into(),
            observed_sha256: expected_sha256.to_string(),
            observed_size_bytes: observed_size,
            observed_modified_at: observed_mtime,
        };
    }

    let bytes = match fs::read(path) {
        Ok(b) => b,
        Err(_) => {
            return FileIntegrityCheck {
                status: "missing".into(),
                observed_sha256: String::new(),
                observed_size_bytes: 0,
                observed_modified_at: String::new(),
            };
        }
    };

    let observed_sha256 = compute_sha256(&bytes);
    let status = if expected_sha256.is_empty() || observed_sha256 == expected_sha256 {
        "verified"
    } else {
        "modified"
    };

    FileIntegrityCheck {
        status: status.into(),
        observed_sha256,
        observed_size_bytes: bytes.len() as i64,
        observed_modified_at: observed_mtime,
    }
}

pub fn sanitize_filename(input: &str) -> String {
    input
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | ' ') {
                c
            } else {
                '_'
            }
        })
        .collect()
}

pub fn mime_for_ext(ext: &str) -> &'static str {
    match ext {
        "pdf" => "application/pdf",
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "txt" => "text/plain",
        _ => "application/octet-stream",
    }
}

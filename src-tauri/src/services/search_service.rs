use crate::errors::AppResult;
use crate::models::document::SearchHit;
use sqlx::{Row, SqlitePool};

pub async fn run_global_search(pool: &SqlitePool, query: &str) -> AppResult<Vec<SearchHit>> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let like = format!("%{}%", trimmed);
    let mut hits: Vec<SearchHit> = Vec::new();

    // 1. Search Assets, Brands, Models, Serials, Rooms
    let asset_rows = sqlx::query(
        "SELECT a.id, a.name, a.brand, a.model, a.serial_number, a.product_id, COALESCE(l.name, '') AS location_name
         FROM assets a
         LEFT JOIN locations l ON a.location_id = l.id
         WHERE a.name LIKE ? OR a.brand LIKE ? OR a.model LIKE ? OR a.serial_number LIKE ? OR a.product_id LIKE ? OR l.name LIKE ?
         ORDER BY a.is_featured DESC, a.name ASC
         LIMIT 12"
    )
    .bind(&like).bind(&like).bind(&like).bind(&like).bind(&like).bind(&like)
    .fetch_all(pool)
    .await?;

    for row in asset_rows {
        let id: String = row.get("id");
        let name: String = row.get("name");
        let brand: String = row.get("brand");
        let model: String = row.get("model");
        let serial: String = row.get("serial_number");
        let location: String = row.get("location_name");
        hits.push(SearchHit {
            kind: "asset".into(),
            id: id.clone(),
            title: name,
            subtitle: format!("{} · {} · {}", brand, model, location),
            snippet: format!("Serial: {}", serial),
            asset_id: Some(id),
            document_id: None,
            page_number: None,
        });
    }

    // 2. Search indexed PDF manual pages (e.g., Error Code E04 -> Page 34)
    let page_rows = sqlx::query(
        "SELECT dp.id, dp.document_id, dp.page_number, dp.content, d.title AS doc_title,
                (SELECT asset_id FROM document_asset_links WHERE document_id = d.id LIMIT 1) AS linked_asset_id
         FROM document_pages dp
         INNER JOIN documents d ON d.id = dp.document_id
         WHERE dp.content LIKE ?
         LIMIT 10"
    )
    .bind(&like)
    .fetch_all(pool)
    .await?;

    for row in page_rows {
        let doc_id: String = row.get("document_id");
        let doc_title: String = row.get("doc_title");
        let page_num: i64 = row.get("page_number");
        let content: String = row.get("content");
        let linked_asset_id: Option<String> = row.get("linked_asset_id");

        hits.push(SearchHit {
            kind: "manual_page".into(),
            id: row.get("id"),
            title: format!("{}.pdf", doc_title),
            subtitle: format!("Page {}", page_num),
            snippet: content,
            asset_id: linked_asset_id,
            document_id: Some(doc_id),
            page_number: Some(page_num),
        });
    }

    // 3. Search Document filenames & titles
    let doc_rows = sqlx::query(
        "SELECT d.id, d.title, d.file_name, d.category,
                (SELECT asset_id FROM document_asset_links WHERE document_id = d.id LIMIT 1) AS linked_asset_id
         FROM documents d
         WHERE d.title LIKE ? OR d.file_name LIKE ?
         LIMIT 8"
    )
    .bind(&like).bind(&like)
    .fetch_all(pool)
    .await?;

    for row in doc_rows {
        let doc_id: String = row.get("id");
        let title: String = row.get("title");
        let file_name: String = row.get("file_name");
        let category: String = row.get("category");
        let linked_asset_id: Option<String> = row.get("linked_asset_id");
        hits.push(SearchHit {
            kind: "document".into(),
            id: doc_id.clone(),
            title,
            subtitle: format!("{} · {}", category, file_name),
            snippet: file_name,
            asset_id: linked_asset_id,
            document_id: Some(doc_id),
            page_number: None,
        });
    }

    Ok(hits)
}

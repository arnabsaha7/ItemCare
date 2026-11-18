use crate::errors::{AppError, AppResult};
use crate::models::asset::AssetRecord;
use chrono::Utc;
use printpdf::*;
use std::io::BufWriter;

pub fn generate_valuation_pdf_bytes(assets: &[AssetRecord], scope_label: &str) -> AppResult<Vec<u8>> {
    let (doc, page1, layer1) = PdfDocument::new(
        "HomeVault Insurance Valuation Report",
        Mm(210.0),
        Mm(297.0),
        "Valuation Layer",
    );

    let font_regular = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let font_bold = doc
        .add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let total_val: f64 = assets.iter().map(|a| a.purchase_price).sum();
    let total_tco: f64 = assets.iter().map(|a| a.total_cost_of_ownership).sum();

    let mut current_layer = doc.get_page(page1).get_layer(layer1);
    current_layer.use_text("HomeVault — Insurance & Moving Valuation Report", 16.0, Mm(18.0), Mm(276.0), &font_bold);
    current_layer.use_text(
        format!(
            "Scope: {}  |  Generated: {}  |  Assets: {}",
            scope_label,
            Utc::now().format("%d %b %Y"),
            assets.len()
        ),
        9.5,
        Mm(18.0),
        Mm(268.0),
        &font_regular,
    );
    current_layer.use_text(
        format!("Total Insured Valuation: INR {:.2}   |   Total Cost of Ownership: INR {:.2}", total_val, total_tco),
        10.5,
        Mm(18.0),
        Mm(260.0),
        &font_bold,
    );

    let mut y = 248.0;
    current_layer.use_text("Asset Name", 9.0, Mm(18.0), Mm(y), &font_bold);
    current_layer.use_text("Location", 9.0, Mm(96.0), Mm(y), &font_bold);
    current_layer.use_text("Serial Number", 9.0, Mm(134.0), Mm(y), &font_bold);
    current_layer.use_text("Value (INR)", 9.0, Mm(174.0), Mm(y), &font_bold);
    y -= 6.0;

    for asset in assets {
        if y < 22.0 {
            let (next_page, next_layer) = doc.add_page(Mm(210.0), Mm(297.0), "Continuation");
            current_layer = doc.get_page(next_page).get_layer(next_layer);
            y = 276.0;
        }
        let short_name: String = asset.name.chars().take(38).collect();
        let short_serial: String = if asset.serial_number.is_empty() {
            "—".into()
        } else {
            asset.serial_number.chars().take(18).collect()
        };
        current_layer.use_text(short_name, 8.5, Mm(18.0), Mm(y), &font_regular);
        current_layer.use_text(&asset.location_name, 8.5, Mm(96.0), Mm(y), &font_regular);
        current_layer.use_text(short_serial, 8.5, Mm(134.0), Mm(y), &font_regular);
        current_layer.use_text(format!("{:.0}", asset.purchase_price), 8.5, Mm(174.0), Mm(y), &font_regular);
        y -= 5.8;
    }

    let mut buffer = Vec::new();
    {
        let mut writer = BufWriter::new(&mut buffer);
        doc.save(&mut writer)
            .map_err(|e| AppError::Internal(e.to_string()))?;
    }
    Ok(buffer)
}

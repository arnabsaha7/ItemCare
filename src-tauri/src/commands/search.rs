use crate::database::AppState;
use crate::errors::AppResult;
use crate::models::document::SearchHit;
use crate::services::search_service::run_global_search;
use tauri::State;

#[tauri::command]
pub async fn global_search(state: State<'_, AppState>, query: String) -> AppResult<Vec<SearchHit>> {
    run_global_search(&state.pool, &query).await
}

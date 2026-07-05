mod commands;
mod watcher;

use watcher::WatcherState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Inicializar logger
    simple_logger::SimpleLogger::new()
        .env()
        .with_module_level("notify", log::LevelFilter::Warn)
        .with_module_level("notify_debouncer_mini", log::LevelFilter::Warn)
        .init()
        .unwrap();
    
    log::info!("Iniciando TaruGit Editor");
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        // Registrar el estado global del watcher (una sola instancia)
        .manage(WatcherState::new())
        .invoke_handler(tauri::generate_handler![
            commands::git_ops::open_repository,
            commands::git_ops::clone_repository,
            commands::git_ops::commit_changes,
            commands::git_ops::get_repo_status,
            commands::git_ops::discard_changes,
            commands::git_ops::get_file_diff,
            commands::git_ops::stage_file,
            commands::git_ops::unstage_file,
            commands::git_ops::list_branches,
            commands::git_ops::switch_branch,
            commands::git_ops::switch_branch_force,
            //commands::git_ops::get_commit_history,
            commands::git_ops::get_commit_diff,
            commands::git_ops::create_branch,
            commands::git_ops::delete_branch,
            commands::git_ops::checkout_remote_branch,
            commands::git_ops::get_conflict_stages,
            commands::git_ops::resolve_conflict,
            commands::git_ops::merge_branches,
            commands::git_ops::rebase_branches,
            commands::git_ops::cherry_pick_commit,
            commands::git_ops::squash_commits,
            commands::git_ops::rebase_continue,
            commands::git_ops::rebase_abort,
            commands::git_ops::merge_abort,
            commands::git_ops::cherry_pick_continue,
            commands::git_ops::cherry_pick_abort,
            commands::git_ops::get_commit_timestamp,
            commands::git_ops::get_commit_diff_structured,
            commands::git_ops::get_repo_state,
            commands::git_ops::get_conflicted_files,
            commands::git_ops::get_commit_history_with_timestamp,
            commands::git_ops::fetch_remote_branches,
            commands::git_ops::push_branch,
            commands::git_ops::get_file_history,
            commands::git_ops::get_stash_list,
            commands::git_ops::get_stash_diff,
            commands::git_ops::save_stash,
            commands::git_ops::apply_stash,
            commands::git_ops::pop_stash,
            commands::git_ops::drop_stash,
            commands::git_ops::clear_all_stashes,
            commands::git_ops::git_status_remote,
            commands::git_ops::pull_branch,
            commands::git_ops::list_tags,
            commands::git_ops::compare_branches,
            commands::git_ops::create_tag,
            commands::git_ops::delete_tag,
            commands::git_ops::get_last_commit_message,
            // Watcher commands
            start_repo_watcher,
            stop_repo_watcher,
            // new functions files
            commands::file_ops::read_file_content,
            commands::file_ops::write_file_content,
            commands::graph_ops::get_commit_graph,
            commands::file_ops::read_file_from_commit,
            commands::file_ops::get_file_info,
            // GitHub Actions
            commands::github_ops::list_workflow_runs,
            commands::github_ops::get_workflow_run_jobs,
            commands::github_ops::get_github_remote_info,
            // Pull Requests
            commands::github_ops::list_pull_requests,
            commands::github_ops::get_pull_request,
            commands::github_ops::get_pull_request_files,
            commands::github_ops::get_pull_request_commits,
            commands::github_ops::create_pull_request,
            commands::github_ops::merge_pull_request,
            commands::github_ops::update_pull_request,
            commands::github_ops::check_pr_readiness,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Inicia el file watcher para el repositorio dado.
/// El frontend lo llama cada vez que abre un repo nuevo.
#[tauri::command]
fn start_repo_watcher(
    repo_path: String,
    state: tauri::State<'_, WatcherState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let path = std::path::PathBuf::from(repo_path);
    state.start(path, app)
}

/// Detiene el watcher activo (p. ej. al cerrar la app o cambiar de repo).
#[tauri::command]
fn stop_repo_watcher(state: tauri::State<'_, WatcherState>) {
    state.stop();
}

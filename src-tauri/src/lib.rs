mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Inicializar logger
    simple_logger::SimpleLogger::new()
        .env()
        .init()
        .unwrap();
    
    log::info!("Iniciando TaruGit Editor");
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
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
            commands::git_ops::get_commit_history,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

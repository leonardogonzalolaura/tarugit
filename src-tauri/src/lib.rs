mod commands;
mod watcher;

use serde::Serialize;
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use watcher::WatcherState;

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupArgs {
    pub open: Option<String>,
    pub temporary: bool,
}

pub struct StartupState(pub Mutex<StartupArgs>);

impl StartupState {
    fn new(args: StartupArgs) -> Self {
        Self(Mutex::new(args))
    }
}

fn parse_startup_args(args: Vec<String>) -> StartupArgs {
    let mut parsed = StartupArgs::default();
    let mut iter = args.into_iter().peekable();

    while let Some(arg) = iter.next() {
        match arg.as_str() {
            "--open" => {
                if let Some(value) = iter.peek() {
                    if !value.starts_with("--") {
                        parsed.open = iter.next();
                    }
                }
            }
            "--temporary" => parsed.temporary = true,
            _ => {
                if let Some(value) = arg.strip_prefix("--open=") {
                    if !value.is_empty() {
                        parsed.open = Some(value.to_string());
                    }
                }
            }
        }
    }

    parsed
}

fn parse_startup_argv(mut argv: Vec<String>) -> StartupArgs {
    // En Windows el primer argumento puede ser la ruta del ejecutable.
    if argv
        .first()
        .map(|arg| !arg.starts_with("--"))
        .unwrap_or(false)
    {
        argv.remove(0);
    }
    parse_startup_args(argv)
}

#[tauri::command]
fn get_startup_args(state: tauri::State<'_, StartupState>) -> StartupArgs {
    state
        .0
        .lock()
        .map(|guard| guard.clone())
        .unwrap_or_default()
}

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
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let parsed = parse_startup_argv(argv);

            if parsed.open.is_none() {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
                return;
            }

            if let Some(state) = app.try_state::<StartupState>() {
                if let Ok(mut guard) = state.0.lock() {
                    *guard = parsed.clone();
                }
            }

            let _ = app.emit("startup-open", parsed);

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        // Registrar el estado global del watcher (una sola instancia)
        .manage(WatcherState::new())
        .manage(StartupState::new(parse_startup_argv(
            std::env::args().collect(),
        )))
        .invoke_handler(tauri::generate_handler![
            get_startup_args,
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
            commands::git_ops::get_commit_branches,
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
            commands::git_ops::get_branch_remote_status,
            commands::git_ops::sync_branch_from_remote,
            commands::git_ops::pull_branch,
            commands::git_ops::list_tags,
            commands::git_ops::compare_branches,
            commands::git_ops::create_tag,
            commands::git_ops::delete_tag,
            commands::git_ops::push_tag,
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

#[cfg(test)]
mod startup_args_tests {
    use super::*;

    #[test]
    fn parses_open_path_and_temporary_flag() {
        let parsed = parse_startup_argv(vec![
            r"C:\Program Files\tarugit\tarugit.exe".into(),
            "--open".into(),
            r"C:\repo\worktree".into(),
            "--temporary".into(),
        ]);

        assert_eq!(parsed.open.as_deref(), Some(r"C:\repo\worktree"));
        assert!(parsed.temporary);
    }

    #[test]
    fn parses_open_equals_form() {
        let parsed = parse_startup_argv(vec![
            "tarugit.exe".into(),
            r"--open=C:\repo\worktree".into(),
        ]);

        assert_eq!(parsed.open.as_deref(), Some(r"C:\repo\worktree"));
        assert!(!parsed.temporary);
    }

    #[test]
    fn ignores_flags_without_path() {
        let parsed = parse_startup_argv(vec!["tarugit.exe".into(), "--temporary".into()]);

        assert_eq!(parsed.open, None);
        assert!(parsed.temporary);
    }

    #[test]
    fn does_not_take_another_flag_as_path() {
        let parsed = parse_startup_argv(vec![
            "tarugit.exe".into(),
            "--open".into(),
            "--temporary".into(),
        ]);

        assert_eq!(parsed.open, None);
        assert!(parsed.temporary);
    }
}

use notify_debouncer_mini::{new_debouncer, DebouncedEvent, DebounceEventResult};
use std::{
    path::PathBuf,
    sync::Mutex,
    time::Duration,
};
use tauri::{AppHandle, Emitter};

type WatcherGuard = Box<dyn std::any::Any + Send>;

pub struct WatcherState {
    inner: Mutex<Option<WatcherGuard>>,
    current_path: Mutex<Option<PathBuf>>,
}

impl WatcherState {
    pub fn new() -> Self {
        WatcherState {
            inner: Mutex::new(None),
            current_path: Mutex::new(None),
        }
    }

    pub fn start(&self, repo_path: PathBuf, app: AppHandle) -> Result<(), String> {
        let git_dir = repo_path.join(".git");
        if !git_dir.exists() {
            return Err(format!("No se encontró directorio .git en {:?}", repo_path));
        }

        {
            let current = self.current_path.lock()
                .map_err(|e| format!("Error al bloquear current_path: {}", e))?;
            if current.as_deref() == Some(repo_path.as_path()) {
                log::info!("[watcher] Ya se está vigilando {:?}, omitiendo reinicio", repo_path);
                return Ok(());
            }
        }

        self.stop();

        log::info!("[watcher] Iniciando watcher en {:?}", repo_path);

        let debouncer = new_debouncer(
            Duration::from_millis(500),
            move |result: DebounceEventResult| {
                match result {
                    Ok(events) => {
                        if should_emit(&events) {
                            log::info!("[watcher] Cambio detectado → emitiendo repo-changed");
                            if let Err(e) = app.emit("repo-changed", ()) {
                                log::warn!("[watcher] Error al emitir evento: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        log::warn!("[watcher] Error en watcher: {:?}", e);
                    }
                }
            },
        )
        .map_err(|e| format!("Error creando watcher: {}", e))?;

        let mut debouncer = debouncer;
        debouncer
            .watcher()
            .watch(&repo_path, notify::RecursiveMode::Recursive)
            .map_err(|e| format!("Error registrando directorio: {}", e))?;

        if let Ok(mut inner) = self.inner.lock() {
            *inner = Some(Box::new(debouncer));
        } else {
            log::error!("[watcher] No se pudo bloquear inner para guardar el watcher");
        }

        if let Ok(mut current) = self.current_path.lock() {
            *current = Some(repo_path);
        } else {
            log::error!("[watcher] No se pudo bloquear current_path para guardar la ruta");
        }

        Ok(())
    }

    pub fn stop(&self) {
        match self.inner.lock() {
            Ok(mut guard) => {
                if guard.is_some() {
                    log::info!("[watcher] Deteniendo watcher anterior");
                    *guard = None;
                }
            }
            Err(e) => {
                log::error!("[watcher] Error al bloquear inner en stop: {}", e);
                return;
            }
        }

        match self.current_path.lock() {
            Ok(mut current) => *current = None,
            Err(e) => log::error!("[watcher] Error al bloquear current_path en stop: {}", e),
        }
    }
}

const IGNORED_SUFFIXES: &[&str] = &[
    "FETCH_HEAD",
    "gc.log",
    "index.lock",
    "config.lock",
    "packed-refs.lock",
];

fn should_emit(events: &[DebouncedEvent]) -> bool {
    for event in events {
        let path_str = event.path.to_string_lossy();

        if path_str.contains("node_modules")
            || path_str.contains("target")
            || path_str.contains("dist")
            || path_str.contains("build")
            || path_str.contains(".git/logs")
        {
            continue;
        }

        if path_str.contains(".git") {
            let is_ignored = IGNORED_SUFFIXES
                .iter()
                .any(|suffix| path_str.ends_with(suffix));
            if is_ignored {
                continue;
            }
        }

        return true;
    }
    false
}

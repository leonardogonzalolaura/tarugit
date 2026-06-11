use notify_debouncer_mini::{new_debouncer, DebouncedEvent, DebounceEventResult};
use std::{
    path::PathBuf,
    sync::Mutex,
    time::Duration,
};
use tauri::{AppHandle, Emitter};

/// Guard que mantiene vivo el debouncer. Al soltarse, el watcher se destruye.
type WatcherGuard = Box<dyn std::any::Any + Send>;

/// Estado global del watcher, almacenado en `tauri::State`.
pub struct WatcherState {
    /// Watcher activo. `None` si no hay repo abierto.
    inner: Mutex<Option<WatcherGuard>>,
    /// Ruta vigilada actualmente.
    current_path: Mutex<Option<PathBuf>>,
}

impl WatcherState {
    pub fn new() -> Self {
        WatcherState {
            inner: Mutex::new(None),
            current_path: Mutex::new(None),
        }
    }

    /// Inicia (o reinicia) el watcher para `repo_path`.
    /// Si ya había uno activo, lo detiene primero.
    pub fn start(&self, repo_path: PathBuf, app: AppHandle) -> Result<(), String> {
        let git_dir = repo_path.join(".git");
        if !git_dir.exists() {
            return Err(format!("No se encontró directorio .git en {:?}", repo_path));
        }

        // Si ya estamos vigilando la misma ruta, no hacemos nada.
        {
            let current = self.current_path.lock().unwrap();
            if current.as_deref() == Some(repo_path.as_path()) {
                log::info!("[watcher] Ya se está vigilando {:?}, omitiendo reinicio", repo_path);
                return Ok(());
            }
        }

        // Detener el watcher anterior.
        self.stop();

        log::info!("[watcher] Iniciando watcher en {:?}", repo_path);

        // Crear el debouncer con 500ms de espera para agrupar eventos rápidos.
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

        // Registrar el directorio del repositorio recursivamente.
        let mut debouncer = debouncer;
        debouncer
            .watcher()
            .watch(&repo_path, notify::RecursiveMode::Recursive)
            .map_err(|e| format!("Error registrando directorio: {}", e))?;

        // Guardar el guard y la ruta actual.
        *self.inner.lock().unwrap() = Some(Box::new(debouncer));
        *self.current_path.lock().unwrap() = Some(repo_path);

        Ok(())
    }

    /// Detiene el watcher activo.
    pub fn stop(&self) {
        let mut guard = self.inner.lock().unwrap();
        if guard.is_some() {
            log::info!("[watcher] Deteniendo watcher anterior");
            *guard = None;
        }
        *self.current_path.lock().unwrap() = None;
    }
}

/// Rutas dentro de `.git` que se ignoran porque cambian con mucha frecuencia
/// sin indicar cambios reales en el estado del repo para el usuario.
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
        
        // Ignorar carpetas pesadas/de compilación
        if path_str.contains("node_modules") 
            || path_str.contains("target") 
            || path_str.contains("dist") 
            || path_str.contains("build")
            || path_str.contains(".git/logs")
        {
            continue;
        }

        // Si es dentro de .git, ignorar archivos temporales o de bloqueo
        if path_str.contains(".git") {
            let is_ignored = IGNORED_SUFFIXES
                .iter()
                .any(|suffix| path_str.ends_with(suffix));
            if is_ignored {
                continue;
            }
        }

        // Si llegó hasta aquí, es un cambio relevante
        return true;
    }
    false
}

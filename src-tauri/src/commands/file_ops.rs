use std::path::Path;
use tauri::command;
use std::fs;

#[command]
pub fn read_file_content(repo_path: String, file_path: String) -> Result<String, String> {
    log::info!("📖 Leyendo contenido del archivo: {}", file_path);
    
    // Validar que la ruta del repositorio existe
    let repo_path_abs = fs::canonicalize(&repo_path)
        .map_err(|e| format!("Error al resolver ruta del repositorio: {}", e))?;
    
    let full_path = repo_path_abs.join(&file_path);
    
    // Validar que el archivo esté dentro del repositorio (seguridad)
    let full_path_abs = fs::canonicalize(&full_path)
        .map_err(|e| format!("Error al resolver ruta del archivo: {}", e))?;
    
    if !full_path_abs.starts_with(&repo_path_abs) {
        return Err("Acceso denegado: El archivo está fuera del repositorio".to_string());
    }
    
    // Verificar que el archivo existe
    if !full_path_abs.is_file() {
        return Err(format!("El archivo no existe: {}", file_path));
    }
    
    fs::read_to_string(&full_path_abs)
        .map_err(|e| format!("Error al leer archivo: {}", e))
}

#[command]
pub fn write_file_content(repo_path: String, file_path: String, content: String) -> Result<String, String> {
    log::info!("💾 Escribiendo contenido en archivo: {}", file_path);
    
    // Validar que la ruta del repositorio existe
    let repo_path_abs = fs::canonicalize(&repo_path)
        .map_err(|e| format!("Error al resolver ruta del repositorio: {}", e))?;
    
    let full_path = repo_path_abs.join(&file_path);
    
    // Validar que el archivo esté dentro del repositorio (seguridad)
    let full_path_abs = fs::canonicalize(&full_path)
        .map_err(|e| format!("Error al resolver ruta del archivo: {}", e))?;
    
    if !full_path_abs.starts_with(&repo_path_abs) {
        return Err("Acceso denegado: El archivo está fuera del repositorio".to_string());
    }
    
    // Crear el directorio si no existe
    if let Some(parent) = full_path_abs.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Error al crear directorio: {}", e))?;
    }
    
    fs::write(&full_path_abs, content)
        .map_err(|e| format!("Error al escribir archivo: {}", e))?;
    
    log::info!("✅ Archivo guardado exitosamente: {}", file_path);
    Ok("Archivo guardado exitosamente".to_string())
}

#[command]
pub fn read_file_from_commit(repo_path: String, commit_id: String, file_path: String) -> Result<String, String> {
    log::info!("📜 Leyendo archivo {} del commit {}", file_path, commit_id);
    
    // Usar git show para leer el archivo de un commit específico
    let output = std::process::Command::new("git")
        .args(["show", &format!("{}:{}", commit_id, file_path)])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Error ejecutando git show: {}", e))?;
    
    if output.status.success() {
        String::from_utf8(output.stdout)
            .map_err(|e| format!("Error decodificando archivo: {}", e))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Error al leer archivo del commit: {}", stderr))
    }
}

// Comando opcional: obtener información del archivo (tamaño, última modificación)
#[command]
pub fn get_file_info(repo_path: String, file_path: String) -> Result<serde_json::Value, String> {
    log::info!("📊 Obteniendo información del archivo: {}", file_path);
    
    let repo_path_abs = fs::canonicalize(&repo_path)
        .map_err(|e| format!("Error al resolver ruta del repositorio: {}", e))?;
    
    let full_path = repo_path_abs.join(&file_path);
    let full_path_abs = fs::canonicalize(&full_path)
        .map_err(|e| format!("Error al resolver ruta del archivo: {}", e))?;
    
    if !full_path_abs.starts_with(&repo_path_abs) {
        return Err("Acceso denegado: El archivo está fuera del repositorio".to_string());
    }
    
    let metadata = fs::metadata(&full_path_abs)
        .map_err(|e| format!("Error al obtener metadata: {}", e))?;
    
    Ok(serde_json::json!({
        "size": metadata.len(),
        "modified": metadata.modified().ok().map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs()),
        "is_file": metadata.is_file(),
        "is_dir": metadata.is_dir(),
    }))
}
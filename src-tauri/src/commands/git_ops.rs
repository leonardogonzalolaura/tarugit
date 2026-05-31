use git2::{Repository, StatusOptions, IndexAddOption, Signature, Commit};
use std::path::Path;
use tauri::command;

// ─── Structs ──────────────────────────────────────────────────────────────────

#[derive(serde::Serialize, Debug)]
pub struct FileStatus {
    pub path: String,
    pub status: String,
}

#[derive(serde::Serialize, Debug)]
pub struct RepoInfo {
    pub current_branch: String,
    pub files: Vec<FileStatus>,
    pub has_commits: bool,
}

#[derive(serde::Serialize, Debug)]
pub struct BranchInfo {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
}

#[derive(serde::Serialize, Debug)]
pub struct CommitInfo {
    pub id: String,
    pub message: String,
    pub author: String,
}

// ─── Repository ───────────────────────────────────────────────────────────────

#[command]
pub fn open_repository(path: String) -> Result<RepoInfo, String> {
    log::info!("Abriendo repositorio en: {}", path);
    let repo_path = Path::new(&path);
    match Repository::open(repo_path) {
        Ok(repo) => {
            log::info!("Repositorio abierto correctamente");
            get_repo_info(&repo)
        }
        Err(e) => {
            log::error!("Error abriendo repositorio: {}", e);
            Err(format!("No es un repositorio Git válido: {}", e))
        }
    }
}

#[command]
pub fn clone_repository(url: String, path: String) -> Result<RepoInfo, String> {
    log::info!("Clonando {} en {}", url, path);
    let repo_path = Path::new(&path);
    if let Some(parent) = repo_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    match Repository::clone(&url, repo_path) {
        Ok(repo) => {
            log::info!("Clonado exitoso");
            get_repo_info(&repo)
        }
        Err(e) => {
            log::error!("Error clonando: {}", e);
            Err(format!("Error al clonar: {}", e))
        }
    }
}

#[command]
pub fn get_repo_status(repo_path: String) -> Result<RepoInfo, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    get_repo_info(&repo)
}

#[derive(serde::Serialize, Debug)]
pub struct ConflictData {
    pub ours: String,
    pub theirs: String,
    pub base: String,
}

fn get_repo_info(repo: &Repository) -> Result<RepoInfo, String> {
    let current_branch = match repo.head() {
        Ok(head) => head.shorthand().unwrap_or("detached").to_string(),
        Err(_) => "no-commits".to_string(),
    };
    let has_commits = repo.head().is_ok();
    let mut opts = StatusOptions::new();
    opts.include_ignored(false);
    opts.include_untracked(true);
    opts.recurse_untracked_dirs(true);
    let files = match repo.statuses(Some(&mut opts)) {
        Ok(statuses) => {
            let mut file_list = Vec::new();
            for entry in statuses.iter() {
                let status = entry.status();
                let path = entry.path().unwrap_or("").to_string();
                let status_str = if status.is_conflicted() {
                    "conflicted".to_string()
                } else if status.is_index_new() || status.is_wt_new() {
                    "untracked".to_string()
                } else if status.is_index_modified() || status.is_wt_modified() {
                    "modified".to_string()
                } else if status.is_index_deleted() || status.is_wt_deleted() {
                    "deleted".to_string()
                } else {
                    "unknown".to_string()
                };
                file_list.push(FileStatus { path, status: status_str });
            }
            file_list
        }
        Err(e) => {
            log::warn!("Error obteniendo status: {}", e);
            Vec::new()
        }
    };
    Ok(RepoInfo { current_branch, files, has_commits })
}

#[command]
pub fn get_conflict_stages(repo_path: String, file_path: String) -> Result<ConflictData, String> {
    log::info!("Obteniendo etapas de conflicto para: {}", file_path);
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    
    // Si el archivo en el workdir tiene marcas de conflicto <<<<<<< ======= >>>>>>>, enviamos el archivo en 'ours' y 'theirs'
    let workdir = repo.workdir().ok_or("No workdir")?;
    let full_path = workdir.join(&file_path);
    let mut raw_content = String::new();
    if let Ok(content) = std::fs::read_to_string(&full_path) {
        raw_content = content;
    }

    let index = repo.index().map_err(|e| e.to_string())?;
    
    let mut ours = String::new();
    let mut theirs = String::new();
    let mut base = String::new();

    if let Some(entry) = index.get_path(Path::new(&file_path), 2) {
        if let Ok(blob) = repo.find_blob(entry.id) {
            ours = String::from_utf8_lossy(blob.content()).to_string();
        }
    }
    if let Some(entry) = index.get_path(Path::new(&file_path), 3) {
        if let Ok(blob) = repo.find_blob(entry.id) {
            theirs = String::from_utf8_lossy(blob.content()).to_string();
        }
    }
    if let Some(entry) = index.get_path(Path::new(&file_path), 1) {
        if let Ok(blob) = repo.find_blob(entry.id) {
            base = String::from_utf8_lossy(blob.content()).to_string();
        }
    }

    // Si tiene marcas de conflicto en disco, mandamos esa versión en 'base' para que el frontend parsee los bloques
    if raw_content.contains("<<<<<<<") && raw_content.contains("=======") && raw_content.contains(">>>>>>>") {
        base = raw_content;
    }

    Ok(ConflictData { ours, theirs, base })
}

#[command]
pub fn resolve_conflict(repo_path: String, file_path: String, merged_text: String) -> Result<String, String> {
    log::info!("Resolviendo conflicto para: {}", file_path);
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    
    // Escribir el resultado fusionado al disco
    let workdir = repo.workdir().ok_or("No workdir")?;
    let full_path = workdir.join(&file_path);
    std::fs::write(&full_path, merged_text).map_err(|e| e.to_string())?;

    let mut index = repo.index().map_err(|e| e.to_string())?;
    
    // Remover las marcas de conflicto (stages 1, 2 y 3) llamando a remove_path
    index.remove_path(Path::new(&file_path)).map_err(|e| e.to_string())?;
    
    // Agregar la versión limpia fusionada del disco (stage 0)
    index.add_path(Path::new(&file_path)).map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;

    Ok("Conflict resolved successfully".to_string())
}

// ─── Commit ───────────────────────────────────────────────────────────────────

#[command]
pub fn commit_changes(repo_path: String, message: String) -> Result<String, String> {
    log::info!("Haciendo commit en: {} con mensaje: {}", repo_path, message);
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index.add_all(["*"].iter(), IndexAddOption::DEFAULT, None).map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;
    let signature = Signature::now("Git Editor User", "user@example.com").map_err(|e| e.to_string())?;
    let tree_id = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_id).map_err(|e| e.to_string())?;
    let parent_commit = repo.head().ok().and_then(|head| head.peel_to_commit().ok());
    let parents: Vec<&Commit> = parent_commit.as_ref().map_or(vec![], |p| vec![p]);
    let commit_id = repo.commit(Some("HEAD"), &signature, &signature, &message, &tree, &parents)
        .map_err(|e| e.to_string())?;
    log::info!("Commit creado: {}", commit_id);
    Ok(format!("✅ Commit creado: {}", commit_id))
}

// ─── Discard / Stage ──────────────────────────────────────────────────────────

#[command]
pub fn discard_changes(repo_path: String, file_path: String) -> Result<String, String> {
    log::info!("Descartando cambios en: {}", file_path);
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;

    // Verificar si el archivo está tracked en HEAD (tiene historial)
    let is_tracked = repo.head()
        .ok()
        .and_then(|h| h.peel_to_tree().ok())
        .and_then(|tree| tree.get_path(Path::new(&file_path)).ok())
        .is_some();

    if is_tracked {
        // Archivo tracked: restaurar desde HEAD (git checkout HEAD -- <file>)
        let mut checkout_opts = git2::build::CheckoutBuilder::new();
        checkout_opts.path(file_path.as_str());
        checkout_opts.force();
        repo.checkout_head(Some(&mut checkout_opts))
            .map_err(|e| format!("Error al restaurar archivo: {}", e))?;
    } else {
        // Archivo untracked / nuevo: eliminarlo del disco
        let workdir = repo.workdir().ok_or("No workdir")?;
        let full_path = workdir.join(&file_path);
        if full_path.is_file() {
            std::fs::remove_file(&full_path)
                .map_err(|e| format!("Error al eliminar archivo: {}", e))?;
        } else if full_path.is_dir() {
            std::fs::remove_dir_all(&full_path)
                .map_err(|e| format!("Error al eliminar directorio: {}", e))?;
        }
    }

    Ok(format!("ok:{}", file_path))
}

#[command]
pub fn get_file_diff(repo_path: String, file_path: String) -> Result<String, String> {
    log::info!("Obteniendo diff de: {}", file_path);
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut diff_opts = git2::DiffOptions::new();
    diff_opts.pathspec(file_path.clone());
    let tree = match repo.head() {
        Ok(head) => head.peel_to_tree().ok(),
        Err(_) => None,
    };
    let diff = match tree {
        Some(tree) => repo.diff_tree_to_workdir(Some(&tree), Some(&mut diff_opts)),
        None => repo.diff_tree_to_workdir(None, Some(&mut diff_opts)),
    }.map_err(|e| e.to_string())?;

    let mut diff_text = String::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        let origin = line.origin();
        let content = String::from_utf8_lossy(line.content());
        match origin {
            '+' | '-' | ' ' | '@' => diff_text.push_str(&format!("{}{}", origin, content)),
            _ => {}
        }
        true
    }).map_err(|e| e.to_string())?;

    if diff_text.is_empty() {
        Ok("NO_CHANGES".to_string())
    } else {
        Ok(diff_text)
    }
}

/// Retorna el diff de un commit específico comparando con su padre
#[command]
pub fn get_commit_diff(repo_path: String, commit_id: String) -> Result<String, String> {
    log::info!("Obteniendo diff del commit: {}", commit_id);
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;

    let oid = git2::Oid::from_str(&commit_id).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
    let commit_tree = commit.tree().map_err(|e| e.to_string())?;

    // Tree del padre (si existe)
    let parent_tree = if commit.parent_count() > 0 {
        let parent = commit.parent(0).map_err(|e| e.to_string())?;
        Some(parent.tree().map_err(|e| e.to_string())?)
    } else {
        None
    };

    let diff = repo.diff_tree_to_tree(
        parent_tree.as_ref(),
        Some(&commit_tree),
        None,
    ).map_err(|e| e.to_string())?;

    let mut diff_text = String::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        let origin = line.origin();
        let content = String::from_utf8_lossy(line.content());
        match origin {
            '+' | '-' | ' ' | '@' => diff_text.push_str(&format!("{}{}", origin, content)),
            _ => {}
        }
        true
    }).map_err(|e| e.to_string())?;

    if diff_text.is_empty() {
        Ok("NO_CHANGES".to_string())
    } else {
        Ok(diff_text)
    }
}

#[command]
pub fn stage_file(repo_path: String, file_path: String) -> Result<String, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index.add_path(std::path::Path::new(&file_path)).map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;
    Ok(format!("✅ Archivo stageado: {}", file_path))
}

#[command]
pub fn unstage_file(repo_path: String, file_path: String) -> Result<String, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index.remove_path(std::path::Path::new(&file_path)).map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;
    Ok(format!("✅ Archivo unstaged: {}", file_path))
}

// ─── Branches ─────────────────────────────────────────────────────────────────

#[command]
pub fn list_branches(repo_path: String) -> Result<Vec<BranchInfo>, String> {
    log::info!("Listando ramas en: {}", repo_path);
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let current_branch = match repo.head() {
        Ok(head) => head.shorthand().unwrap_or("").to_string(),
        Err(_) => String::new(),
    };
    let mut branches = Vec::new();

    let local_iter = repo.branches(Some(git2::BranchType::Local)).map_err(|e| e.to_string())?;
    for br in local_iter {
        let (b, _) = br.map_err(|e| e.to_string())?;
        let name = b.name().map_err(|e| e.to_string())?.unwrap_or("").to_string();
        if !name.is_empty() {
            branches.push(BranchInfo { is_current: name == current_branch, name, is_remote: false });
        }
    }

    let remote_iter = repo.branches(Some(git2::BranchType::Remote)).map_err(|e| e.to_string())?;
    for br in remote_iter {
        let (b, _) = br.map_err(|e| e.to_string())?;
        let name = b.name().map_err(|e| e.to_string())?.unwrap_or("").to_string();
        if !name.is_empty() {
            branches.push(BranchInfo { is_current: false, name, is_remote: true });
        }
    }
    Ok(branches)
}

/// Retorna "DIRTY" si hay cambios sin commitear, de lo contrario cambia la rama
#[command]
pub fn switch_branch(repo_path: String, branch_name: String) -> Result<RepoInfo, String> {
    log::info!("Cambiando a rama: {}", branch_name);
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;

    // Verificar si el working tree está sucio
    let mut status_opts = StatusOptions::new();
    status_opts.include_untracked(true);
    status_opts.include_ignored(false);
    let statuses = repo.statuses(Some(&mut status_opts)).map_err(|e| e.to_string())?;
    if !statuses.is_empty() {
        return Err("DIRTY_WORKING_TREE".to_string());
    }

    let branch = repo.find_branch(&branch_name, git2::BranchType::Local)
        .map_err(|e| format!("Rama no encontrada: {}", e))?;
    let ref_name = branch.get().name().ok_or("Nombre de referencia inválido")?.to_string();
    let obj = repo.revparse_single(&ref_name).map_err(|e| e.to_string())?;
    repo.checkout_tree(&obj, None).map_err(|e| format!("Error en checkout: {}", e))?;
    repo.set_head(&ref_name).map_err(|e| format!("Error actualizando HEAD: {}", e))?;
    get_repo_info(&repo)
}

/// Fuerza el cambio de rama trayendo los cambios no commiteados
#[command]
pub fn switch_branch_force(repo_path: String, branch_name: String) -> Result<RepoInfo, String> {
    log::info!("Forzando cambio a rama: {}", branch_name);
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let branch = repo.find_branch(&branch_name, git2::BranchType::Local)
        .map_err(|e| format!("Rama no encontrada: {}", e))?;
    let ref_name = branch.get().name().ok_or("Nombre de referencia inválido")?.to_string();
    let obj = repo.revparse_single(&ref_name).map_err(|e| e.to_string())?;

    let mut checkout_opts = git2::build::CheckoutBuilder::new();
    checkout_opts.safe(); // Preserva cambios locales al hacer checkout
    repo.checkout_tree(&obj, Some(&mut checkout_opts))
        .map_err(|e| format!("Error en checkout: {}", e))?;
    repo.set_head(&ref_name).map_err(|e| format!("Error actualizando HEAD: {}", e))?;
    get_repo_info(&repo)
}

#[command]
pub fn create_branch(repo_path: String, branch_name: String, source_branch: Option<String>) -> Result<String, String> {
    log::info!("Creando rama: {} en {}", branch_name, repo_path);
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    
    let target_commit = if let Some(src) = source_branch {
        let src_branch = repo.find_branch(&src, git2::BranchType::Local)
            .map_err(|e| format!("Rama de origen no encontrada: {}", e))?;
        src_branch.get().peel_to_commit().map_err(|e| e.to_string())?
    } else {
        let head = repo.head().map_err(|e| format!("No se pudo obtener HEAD: {}", e))?;
        head.peel_to_commit().map_err(|e| e.to_string())?
    };

    repo.branch(&branch_name, &target_commit, false).map_err(|e| e.to_string())?;
    Ok(format!("Rama '{}' creada con éxito", branch_name))
}

#[command]
pub fn delete_branch(repo_path: String, branch_name: String) -> Result<String, String> {
    log::info!("Eliminando rama: {} en {}", branch_name, repo_path);
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut branch = repo.find_branch(&branch_name, git2::BranchType::Local).map_err(|e| e.to_string())?;
    branch.delete().map_err(|e| e.to_string())?;
    Ok(format!("Rama '{}' eliminada con éxito", branch_name))
}

#[command]
pub fn checkout_remote_branch(repo_path: String, branch_name: String) -> Result<String, String> {
    log::info!("Creando tracking local para rama remota: {} en {}", branch_name, repo_path);
    let output = std::process::Command::new("git")
        .args(["checkout", "-t", &branch_name])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;
        
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    
    if output.status.success() {
        Ok(stdout)
    } else {
        Err(format!("Error al hacer checkout remoto:\n{}\n{}", stdout, stderr))
    }
}

// ─── History ──────────────────────────────────────────────────────────────────

#[command]
pub fn get_commit_history(repo_path: String) -> Result<Vec<CommitInfo>, String> {
    log::info!("Obteniendo historial en: {}", repo_path);
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    
    // Si no hay commits, retornar historial vacío en lugar de crashear
    if revwalk.push_head().is_err() {
        return Ok(Vec::new());
    }
    
    revwalk.set_sorting(git2::Sort::TIME).map_err(|e| e.to_string())?;
    let mut history = Vec::new();
    for oid_result in revwalk {
        if let Ok(oid) = oid_result {
            if let Ok(commit) = repo.find_commit(oid) {
                history.push(CommitInfo {
                    id: oid.to_string(),
                    message: commit.message().unwrap_or("").trim().to_string(),
                    author: commit.author().name().unwrap_or("Unknown").to_string(),
                });
            }
        }
    }
    Ok(history)
}

#[command]
pub fn merge_branches(repo_path: String, branch_name: String) -> Result<String, String> {
    log::info!("Fusionando rama {} en actual", branch_name);
    let output = std::process::Command::new("git")
        .args(["merge", &branch_name])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if output.status.success() {
        Ok(stdout)
    } else {
        Err(format!("Error en merge:\n{}\n{}", stdout, stderr))
    }
}

#[command]
pub fn rebase_branches(repo_path: String, branch_name: String) -> Result<String, String> {
    log::info!("Haciendo rebase sobre la rama {}", branch_name);
    let output = std::process::Command::new("git")
        .args(["rebase", &branch_name])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if output.status.success() {
        Ok(stdout)
    } else {
        Err(format!("Error en rebase:\n{}\n{}", stdout, stderr))
    }
}

#[command]
pub fn cherry_pick_commit(repo_path: String, commit_id: String) -> Result<String, String> {
    log::info!("Aplicando cherry-pick del commit {}", commit_id);
    let output = std::process::Command::new("git")
        .args(["cherry-pick", &commit_id])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if output.status.success() {
        Ok(stdout)
    } else {
        Err(format!("Error en cherry-pick:\n{}\n{}", stdout, stderr))
    }
}

// ─── Conflict Recovery ────────────────────────────────────────────────────────

#[command]
pub fn rebase_continue(repo_path: String) -> Result<String, String> {
    log::info!("Continuando rebase en: {}", repo_path);
    // Primero agregamos todos los archivos al índice (equivalente a git add -A)
    let add_output = std::process::Command::new("git")
        .args(["add", "-A"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;
    if !add_output.status.success() {
        let stderr = String::from_utf8_lossy(&add_output.stderr).to_string();
        return Err(format!("Error al preparar archivos: {}", stderr));
    }
    let output = std::process::Command::new("git")
        .args(["rebase", "--continue"])
        .env("GIT_EDITOR", "true") // Evita que abra un editor interactivo
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if output.status.success() {
        Ok(stdout)
    } else {
        Err(format!("Error al continuar rebase:\n{}\n{}", stdout, stderr))
    }
}

#[command]
pub fn rebase_abort(repo_path: String) -> Result<String, String> {
    log::info!("Abortando rebase en: {}", repo_path);
    let output = std::process::Command::new("git")
        .args(["rebase", "--abort"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if output.status.success() {
        Ok(stdout)
    } else {
        Err(format!("Error al abortar rebase:\n{}\n{}", stdout, stderr))
    }
}

#[command]
pub fn merge_abort(repo_path: String) -> Result<String, String> {
    log::info!("Abortando merge en: {}", repo_path);
    let output = std::process::Command::new("git")
        .args(["merge", "--abort"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if output.status.success() {
        Ok(stdout)
    } else {
        Err(format!("Error al abortar merge:\n{}\n{}", stdout, stderr))
    }
}

#[command]
pub fn cherry_pick_continue(repo_path: String) -> Result<String, String> {
    log::info!("Continuando cherry-pick en: {}", repo_path);
    let add_output = std::process::Command::new("git")
        .args(["add", "-A"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;
    if !add_output.status.success() {
        let stderr = String::from_utf8_lossy(&add_output.stderr).to_string();
        return Err(format!("Error al preparar archivos: {}", stderr));
    }
    let output = std::process::Command::new("git")
        .args(["cherry-pick", "--continue"])
        .env("GIT_EDITOR", "true")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if output.status.success() {
        Ok(stdout)
    } else {
        Err(format!("Error al continuar cherry-pick:\n{}\n{}", stdout, stderr))
    }
}

#[command]
pub fn cherry_pick_abort(repo_path: String) -> Result<String, String> {
    log::info!("Abortando cherry-pick en: {}", repo_path);
    let output = std::process::Command::new("git")
        .args(["cherry-pick", "--abort"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if output.status.success() {
        Ok(stdout)
    } else {
        Err(format!("Error al abortar cherry-pick:\n{}\n{}", stdout, stderr))
    }
}

// ─── Squash ───────────────────────────────────────────────────────────────────

#[command]
pub fn squash_commits(repo_path: String, count: usize, message: String) -> Result<String, String> {
    log::info!("Squashing los últimos {} commits con mensaje: {}", count, message);
    if count < 2 {
        return Err("Se necesitan al menos 2 commits para hacer squash".to_string());
    }
    
    // git reset --soft HEAD~N
    let reset_arg = format!("HEAD~{}", count);
    let output = std::process::Command::new("git")
        .args(["reset", "--soft", &reset_arg])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;
        
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("Error en reset para squash:\n{}", stderr));
    }
    
    // git commit -m "message"
    let commit_output = std::process::Command::new("git")
        .args(["commit", "-m", &message])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;
        
    if commit_output.status.success() {
        Ok("Squash realizado con éxito".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&commit_output.stderr).to_string();
        Err(format!("Error al crear commit de squash:\n{}", stderr))
    }
}

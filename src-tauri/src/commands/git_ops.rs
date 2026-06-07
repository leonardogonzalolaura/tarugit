use git2::{Repository, StatusOptions, IndexAddOption, Signature, Commit};
use std::path::Path;
use tauri::command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

fn create_git_command() -> std::process::Command {
    let mut cmd = std::process::Command::new("git");
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

// ─── Structs ──────────────────────────────────────────────────────────────────
#[derive(serde::Serialize, Debug)]
pub struct GitRemoteStatus {
    ahead: i32,
    behind: i32,
    has_remote: bool,
}

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

#[derive(serde::Serialize, Debug)]
pub struct ConflictData {
    pub ours: String,
    pub theirs: String,
    pub base: String,
    pub raw: String,
}

#[derive(serde::Serialize, Debug)]
pub struct FileDiffInfo {
    pub path: String,
    pub diff: String,
    pub additions: i32,
    pub deletions: i32,
}

#[derive(serde::Serialize, Debug)]
pub struct RepoState {
    pub is_rebasing: bool,
    pub is_merging: bool,
    pub is_cherry_picking: bool,
    pub current_operation: Option<String>,
}

// ─── Repository ───────────────────────────────────────────────────────────────

#[command]
pub fn open_repository(path: String) -> Result<RepoInfo, String> {
    log::info!("Abriendo repositorio en: {}", path);
    let repo_path = Path::new(&path);
    match Repository::open(repo_path) {
        Ok(repo) => {
            log::info!("Repositorio abierto correctamente");
            // Pasar false como has_pending_operation inicial
            get_repo_info(&repo, false)
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
            get_repo_info(&repo, false)
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
    
    // Detectar si hay operación en curso (rebase, merge, cherry-pick)
    let git_dir = repo.path().to_path_buf();
    let is_cherry_picking = git_dir.join("CHERRY_PICK_HEAD").exists();
    let is_rebasing = git_dir.join("rebase-merge").exists() || git_dir.join("rebase-apply").exists();
    let is_merging = git_dir.join("MERGE_HEAD").exists();
    
    let has_pending_operation = is_cherry_picking || is_rebasing || is_merging;
    
    // Si hay cherry-pick en curso, también verificar el archivo CHERRY_PICK_HEAD
    if is_cherry_picking {
        log::info!("Cherry-pick en curso detectado");
    }
    
    get_repo_info(&repo, has_pending_operation)
}

#[command]
pub fn get_repo_state(repo_path: String) -> Result<RepoState, String> {
    log::info!("Obteniendo estado del repositorio: {}", repo_path);
    
    let git_dir = format!("{}/.git", repo_path);
    
    let is_rebasing = std::path::Path::new(&format!("{}/rebase-merge", git_dir)).exists()
        || std::path::Path::new(&format!("{}/rebase-apply", git_dir)).exists();
    
    let is_merging = std::path::Path::new(&format!("{}/MERGE_HEAD", git_dir)).exists();
    
    let is_cherry_picking = std::path::Path::new(&format!("{}/CHERRY_PICK_HEAD", git_dir)).exists();
    
    let current_operation = if is_rebasing {
        Some("rebase".to_string())
    } else if is_merging {
        Some("merge".to_string())
    } else if is_cherry_picking {
        Some("cherry-pick".to_string())
    } else {
        None
    };
    
    Ok(RepoState {
        is_rebasing,
        is_merging,
        is_cherry_picking,
        current_operation,
    })
}

fn get_repo_info(repo: &Repository, has_pending_operation: bool) -> Result<RepoInfo, String> {
    let current_branch = match repo.head() {
        Ok(head) => head.shorthand().unwrap_or("detached").to_string(),
        Err(_) => "no-commits".to_string(),
    };
    let has_commits = repo.head().is_ok();
    let mut opts = StatusOptions::new();
    opts.include_ignored(false);
    opts.include_untracked(true);
    opts.recurse_untracked_dirs(true);
    
    let mut files = match repo.statuses(Some(&mut opts)) {
        Ok(statuses) => {
            let mut file_list = Vec::new();
            for entry in statuses.iter() {
                let status = entry.status();
                let path = entry.path().unwrap_or("").to_string();
                let status_str = if status.is_conflicted() {
                    log::info!("Archivo en conflicto detectado por status: {}", path);
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
    
    // Si hay una operación pendiente, verificar también archivos con conflicto en el índice
    if has_pending_operation {
        if let Ok(index) = repo.index() {
            log::info!("Verificando índice en busca de conflictos...");
            for entry in index.iter() {
                let path = String::from_utf8_lossy(&entry.path).to_string();
                
                // Verificar si el archivo tiene stages múltiples (1,2,3)
                let has_conflict_stages = index.get_path(Path::new(&path), 1).is_some()
                    || index.get_path(Path::new(&path), 2).is_some()
                    || index.get_path(Path::new(&path), 3).is_some();
                
                if has_conflict_stages && !files.iter().any(|f| f.path == path) {
                    log::info!("Archivo en conflicto encontrado en índice: {}", path);
                    files.push(FileStatus { 
                        path, 
                        status: "conflicted".to_string() 
                    });
                }
            }
        }
        
        // También verificar usando git status por si acaso
        let git_dir = repo.path().to_path_buf();
        let git_dir_str = git_dir.to_string_lossy().to_string();
        let repo_parent = git_dir_str.replace("/.git", "").replace("\\.git", "");
        
        let output = create_git_command()
            .args(["status", "--porcelain"])
            .current_dir(&repo_parent)
            .output();
            
        if let Ok(output) = output {
            let status_output = String::from_utf8_lossy(&output.stdout);
            for line in status_output.lines() {
                if line.starts_with("UU") {
                    let path = if line.len() > 3 { &line[3..] } else { "" };
                    if !path.is_empty() && !files.iter().any(|f| f.path == path) {
                        log::info!("Archivo en conflicto detectado por git status: {}", path);
                        files.push(FileStatus { 
                            path: path.to_string(), 
                            status: "conflicted".to_string() 
                        });
                    }
                }
            }
        }
    }
    
    Ok(RepoInfo { current_branch, files, has_commits })
}

#[command]
pub fn get_conflicted_files(repo_path: String) -> Result<Vec<String>, String> {
    log::info!("Obteniendo archivos en conflicto en: {}", repo_path);
    
    let output = create_git_command()
        .args(["diff", "--name-only", "--diff-filter=U"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Error ejecutando git diff: {}", e))?;
    
    let output_str = String::from_utf8_lossy(&output.stdout);
    let files: Vec<String> = output_str
        .lines()
        .filter(|line| !line.is_empty())
        .map(|s| s.to_string())
        .collect();
    
    log::info!("Archivos en conflicto encontrados: {:?}", files);
    Ok(files)
}

#[command]
pub fn get_conflict_stages(repo_path: String, file_path: String) -> Result<ConflictData, String> {
    log::info!("Obteniendo etapas de conflicto para: {}", file_path);
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    
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

    if (ours.is_empty() && theirs.is_empty()) && 
       (raw_content.contains("<<<<<<<") && raw_content.contains("=======") && raw_content.contains(">>>>>>>")) {
        base = raw_content.clone();
    }

    Ok(ConflictData { ours, theirs, base, raw: raw_content })
}

#[command]
pub fn resolve_conflict(repo_path: String, file_path: String, merged_text: String) -> Result<String, String> {
    log::info!("Resolviendo conflicto para: {}", file_path);
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    
    let workdir = repo.workdir().ok_or("No workdir")?;
    let full_path = workdir.join(&file_path);
    std::fs::write(&full_path, merged_text).map_err(|e| e.to_string())?;

    let mut index = repo.index().map_err(|e| e.to_string())?;
    index.remove_path(Path::new(&file_path)).map_err(|e| e.to_string())?;
    index.add_path(Path::new(&file_path)).map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;

    Ok("Conflict resolved successfully".to_string())
}

// ─── Commit ───────────────────────────────────────────────────────────────────

#[command]
pub fn commit_changes(repo_path: String, message: String, author_name: Option<String>, author_email: Option<String>) -> Result<String, String> {
    log::info!("Haciendo commit en: {} con mensaje: {}", repo_path, message);
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index.add_all(["*"].iter(), IndexAddOption::DEFAULT, None).map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;
    
    let name = author_name.unwrap_or_else(|| "Git Editor User".to_string());
    let email = author_email.unwrap_or_else(|| "user@example.com".to_string());
    let signature = Signature::now(&name, &email).map_err(|e| e.to_string())?;
    
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

    let is_tracked = repo.head()
        .ok()
        .and_then(|h| h.peel_to_tree().ok())
        .and_then(|tree| tree.get_path(Path::new(&file_path)).ok())
        .is_some();

    if is_tracked {
        let mut checkout_opts = git2::build::CheckoutBuilder::new();
        checkout_opts.path(file_path.as_str());
        checkout_opts.force();
        repo.checkout_head(Some(&mut checkout_opts))
            .map_err(|e| format!("Error al restaurar archivo: {}", e))?;
    } else {
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

#[command]
pub fn get_commit_diff(repo_path: String, commit_id: String) -> Result<String, String> {
    log::info!("Obteniendo diff del commit: {}", commit_id);
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;

    let oid = git2::Oid::from_str(&commit_id).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
    let commit_tree = commit.tree().map_err(|e| e.to_string())?;

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
pub fn get_commit_diff_structured(repo_path: String, commit_id: String) -> Result<Vec<FileDiffInfo>, String> {
    log::info!("Obteniendo diff estructurado del commit: {}", commit_id);
    
    // Run a single git command to get all diffs instead of spawning a process per file
    let diff_output = create_git_command()
        .args(["show", "--format=", "--unified=3", &commit_id])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Error ejecutando git show: {}", e))?;
        
    let diff_content = String::from_utf8_lossy(&diff_output.stdout);
    
    let mut result = Vec::new();
    let mut current_file = String::new();
    let mut current_diff = String::new();
    let mut additions = 0;
    let mut deletions = 0;
    
    for line in diff_content.lines() {
        if line.starts_with("diff --git ") {
            // Save the previous file's diff if it exists
            if !current_file.is_empty() {
                result.push(FileDiffInfo {
                    path: current_file.clone(),
                    diff: current_diff.clone(),
                    additions,
                    deletions,
                });
            }
            
            current_diff.clear();
            additions = 0;
            deletions = 0;
            
            // Extract the filename. Format is "diff --git a/path b/path"
            let path_part = &line["diff --git ".len()..];
            // Handle quotes for files with spaces
            if path_part.starts_with('"') {
                if let Some(end_quote) = path_part[1..].find('"') {
                    let a_path = &path_part[1..=end_quote];
                    // The b_path will start after `a_path" "b/`
                    let b_path_marker = format!("\" \"b/");
                    if let Some(b_idx) = path_part.find(&b_path_marker) {
                        let b_start = b_idx + b_path_marker.len() - 2; // Keep 'b/'
                        if let Some(b_end) = path_part[b_start + 1..].find('"') {
                            current_file = path_part[b_start + 2..b_start + 1 + b_end].to_string();
                        }
                    }
                }
            } else {
                // If there's " b/", use it to split
                if let Some(b_idx) = path_part.rfind(" b/") {
                    current_file = path_part[b_idx + 3..].to_string();
                } else {
                    current_file = path_part.to_string(); // Fallback
                }
            }
            
            current_diff.push_str(line);
            current_diff.push('\n');
        } else {
            if !current_file.is_empty() {
                if line.starts_with('+') && !line.starts_with("+++") {
                    additions += 1;
                } else if line.starts_with('-') && !line.starts_with("---") {
                    deletions += 1;
                }
                current_diff.push_str(line);
                current_diff.push('\n');
            }
        }
    }
    
    // Add the last file
    if !current_file.is_empty() {
        result.push(FileDiffInfo {
            path: current_file,
            diff: current_diff,
            additions,
            deletions,
        });
    }
    
    log::info!("Se encontraron {} archivos modificados", result.len());
    Ok(result)
}

#[command]
pub fn push_branch(repo_path: String, branch_name: String) -> Result<String, String> {
    log::info!("Haciendo push de la rama {} en {}", branch_name, repo_path);
    
    let output = create_git_command()
        .args(["push", "-u", "origin", &branch_name])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Error ejecutando git push: {}", e))?;
        
    if output.status.success() {
        Ok("Push completado con éxito".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Error en git push:\n{}", stderr))
    }
}

#[command]
pub fn get_commit_timestamp(repo_path: String, commit_id: String) -> Result<i64, String> {
    let output = create_git_command()
        .args(["show", "-s", "--format=%ct", &commit_id])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Error obteniendo timestamp: {}", e))?;
    
    let timestamp_str = String::from_utf8_lossy(&output.stdout);
    let timestamp = timestamp_str.trim().parse::<i64>().unwrap_or(0);
    Ok(timestamp)
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

#[command]
pub fn switch_branch(repo_path: String, branch_name: String) -> Result<RepoInfo, String> {
    log::info!("Cambiando a rama: {}", branch_name);
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;

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
    get_repo_info(&repo, false)
}

#[command]
pub fn switch_branch_force(repo_path: String, branch_name: String) -> Result<RepoInfo, String> {
    log::info!("Forzando cambio a rama: {}", branch_name);
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let branch = repo.find_branch(&branch_name, git2::BranchType::Local)
        .map_err(|e| format!("Rama no encontrada: {}", e))?;
    let ref_name = branch.get().name().ok_or("Nombre de referencia inválido")?.to_string();
    let obj = repo.revparse_single(&ref_name).map_err(|e| e.to_string())?;

    let mut checkout_opts = git2::build::CheckoutBuilder::new();
    checkout_opts.safe();
    repo.checkout_tree(&obj, Some(&mut checkout_opts))
        .map_err(|e| format!("Error en checkout: {}", e))?;
    repo.set_head(&ref_name).map_err(|e| format!("Error actualizando HEAD: {}", e))?;
    get_repo_info(&repo, false)
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
    let output = create_git_command()
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

#[derive(serde::Serialize, Debug)]
pub struct CommitInfoWithTimestamp {
    pub id: String,
    pub message: String,
    pub author: String,
    pub timestamp: i64,
}

#[command]
pub fn get_commit_history_with_timestamp(repo_path: String) -> Result<Vec<CommitInfoWithTimestamp>, String> {
    log::info!("Obteniendo historial con timestamp en: {}", repo_path);
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    
    if revwalk.push_head().is_err() {
        return Ok(Vec::new());
    }
    
    revwalk.set_sorting(git2::Sort::TIME).map_err(|e| e.to_string())?;
    let mut history = Vec::new();
    
    for oid_result in revwalk {
        if let Ok(oid) = oid_result {
            if let Ok(commit) = repo.find_commit(oid) {
                history.push(CommitInfoWithTimestamp {
                    id: oid.to_string(),
                    message: commit.message().unwrap_or("").trim().to_string(),
                    author: commit.author().name().unwrap_or("Unknown").to_string(),
                    timestamp: commit.time().seconds(),
                });
            }
        }
    }
    log::info!("Se encontraron {} commits", history.len());
    Ok(history)
}

#[command]
pub fn merge_branches(repo_path: String, branch_name: String) -> Result<String, String> {
    log::info!("Fusionando rama {} en actual", branch_name);
    let output = create_git_command()
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
    let output = create_git_command()
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
    
    let git_dir = format!("{}/.git", repo_path);
    if std::path::Path::new(&format!("{}/CHERRY_PICK_HEAD", git_dir)).exists() {
        return Err("CHERRY_PICK_IN_PROGRESS: Ya hay un cherry-pick en curso. Resuelve los conflictos o aborta primero.".to_string());
    }
    
    let output = create_git_command()
        .args(["cherry-pick", &commit_id])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    
    if output.status.success() {
        Ok(stdout)
    } else {
        if stderr.contains("CONFLICT") || stderr.contains("conflict") || stdout.contains("CONFLICT") {
            let status_output = create_git_command()
                .args(["status", "--porcelain"])
                .current_dir(&repo_path)
                .output()
                .map_err(|e| e.to_string())?;
            
            let status = String::from_utf8_lossy(&status_output.stdout);
            let conflicted_files: Vec<&str> = status
                .lines()
                .filter(|line| line.starts_with("UU") || line.contains("both modified"))
                .map(|line| {
                    if line.len() > 3 { &line[3..] } else { line }
                })
                .collect();
            
            if !conflicted_files.is_empty() {
                return Err(format!("CONFLICT: Cherry-pick generó conflictos en los siguientes archivos:\n{}", conflicted_files.join("\n")));
            }
            Err(format!("CONFLICT: Error en cherry-pick:\n{}", stderr))
        } else {
            Err(format!("Error en cherry-pick:\n{}", stderr))
        }
    }
}

// ─── Conflict Recovery ────────────────────────────────────────────────────────

#[command]
pub fn rebase_continue(repo_path: String) -> Result<String, String> {
    log::info!("Continuando rebase en: {}", repo_path);
    let add_output = create_git_command()
        .args(["add", "-A"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;
    if !add_output.status.success() {
        let stderr = String::from_utf8_lossy(&add_output.stderr).to_string();
        return Err(format!("Error al preparar archivos: {}", stderr));
    }
    let output = create_git_command()
        .args(["rebase", "--continue"])
        .env("GIT_EDITOR", "true")
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
    let output = create_git_command()
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
    let output = create_git_command()
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
    let add_output = create_git_command()
        .args(["add", "-A"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;
    if !add_output.status.success() {
        let stderr = String::from_utf8_lossy(&add_output.stderr).to_string();
        return Err(format!("Error al preparar archivos: {}", stderr));
    }
    let output = create_git_command()
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
    let output = create_git_command()
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
    
    let reset_arg = format!("HEAD~{}", count);
    let output = create_git_command()
        .args(["reset", "--soft", &reset_arg])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;
        
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("Error en reset para squash:\n{}", stderr));
    }
    
    let commit_output = create_git_command()
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

#[command]
pub fn fetch_remote_branches(repo_path: String) -> Result<String, String> {
    log::info!("Actualizando ramas remotas en: {}", repo_path);
    
    let output = create_git_command()
        .args(["fetch", "--all", "--prune"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Error al hacer fetch: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    
    if output.status.success() {
        log::info!("Fetch completado exitosamente");
        Ok(stdout)
    } else {
        Err(format!("Error en fetch: {}", stderr))
    }
}

// ─── Stash Operations ──────────────────────────────────────────────────────────

#[derive(serde::Serialize, Debug)]
pub struct StashInfo {
    pub index: usize,
    pub id: String,
    pub name: String,
    pub message: String,
}

#[command]
pub fn get_stash_list(repo_path: String) -> Result<Vec<StashInfo>, String> {
    log::info!("Obteniendo lista de stash en: {}", repo_path);
    let output = create_git_command()
        .args(["stash", "list", "--format=%gd|%gs"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Error ejecutando git stash list: {}", e))?;
        
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("Error al listar stash: {}", stderr));
    }
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut stashes = Vec::new();
    for (index, line) in stdout.lines().enumerate() {
        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() >= 2 {
            let gd = parts[0].to_string();
            let gs = parts[1..].join("|");
            stashes.push(StashInfo {
                index,
                id: gd.clone(),
                name: gd,
                message: gs,
            });
        }
    }
    Ok(stashes)
}

#[command]
pub fn save_stash(
    repo_path: String,
    message: Option<String>,
    include_untracked: bool,
    files: Option<Vec<String>>
) -> Result<String, String> {
    log::info!("Guardando stash en: {} (untracked: {})", repo_path, include_untracked);
    let mut args = vec!["stash".to_string(), "push".to_string()];
    
    if include_untracked {
        args.push("-u".to_string());
    }
    
    if let Some(msg) = message {
        if !msg.trim().is_empty() {
            args.push("-m".to_string());
            args.push(msg.trim().to_string());
        }
    }
    
    if let Some(f_list) = files {
        if !f_list.is_empty() {
            args.push("--".to_string());
            for f in f_list {
                args.push(f);
            }
        }
    }
    
    let output = create_git_command()
        .args(&args)
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Error ejecutando git stash push: {}", e))?;
        
    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        if stdout.contains("No local changes to save") {
            Err("No hay cambios locales para guardar en el stash".to_string())
        } else {
            Ok("Stash guardado exitosamente".to_string())
        }
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Error al crear stash:\n{}", stderr))
    }
}

#[command]
pub fn apply_stash(repo_path: String, stash_id: String) -> Result<String, String> {
    log::info!("Aplicando stash {} en: {}", stash_id, repo_path);
    let output = create_git_command()
        .args(["stash", "apply", &stash_id])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Error ejecutando git stash apply: {}", e))?;
        
    if output.status.success() {
        Ok("Stash aplicado con éxito".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Error al aplicar stash:\n{}", stderr))
    }
}

#[command]
pub fn pop_stash(repo_path: String, stash_id: String) -> Result<String, String> {
    log::info!("Haciendo pop de stash {} en: {}", stash_id, repo_path);
    let output = create_git_command()
        .args(["stash", "pop", &stash_id])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Error ejecutando git stash pop: {}", e))?;
        
    if output.status.success() {
        Ok("Stash aplicado y eliminado con éxito".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Error al hacer pop de stash:\n{}", stderr))
    }
}

#[command]
pub fn drop_stash(repo_path: String, stash_id: String) -> Result<String, String> {
    log::info!("Eliminando stash {} en: {}", stash_id, repo_path);
    let output = create_git_command()
        .args(["stash", "drop", &stash_id])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Error ejecutando git stash drop: {}", e))?;
        
    if output.status.success() {
        Ok("Stash eliminado con éxito".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Error al eliminar stash:\n{}", stderr))
    }
}

#[command]
pub fn git_status_remote(repo_path: String, branch_name: String) -> Result<GitRemoteStatus, String> {
    log::info!("Obteniendo estado remoto para branch {} en: {}", branch_name, repo_path);
    
    // Verificar si existe algún remoto configurado
    let remote_check = create_git_command()
        .args(["remote"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Error verificando remotos: {}", e))?;
    
    let has_remote = !String::from_utf8_lossy(&remote_check.stdout).trim().is_empty();
    
    if !has_remote {
        log::info!("No hay remotos configurados en el repositorio");
        return Ok(GitRemoteStatus {
            ahead: 0,
            behind: 0,
            has_remote: false,
        });
    }
    
    // Verificar si la rama tiene upstream configurado
    let upstream_check = create_git_command()
        .args(["rev-parse", "--abbrev-ref", &format!("{0}@{{u}}", branch_name)])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Error verificando upstream: {}", e))?;
    
    if !upstream_check.status.success() {
        log::info!("La rama {} no tiene upstream configurado", branch_name);
        return Ok(GitRemoteStatus {
            ahead: 0,
            behind: 0,
            has_remote: true,
        });
    }
    
    // Obtener la diferencia entre local y remoto usando rev-list
    // El formato de salida de rev-list --count --left-right es: "<ahead>\t<behind>"
    let diff_output = create_git_command()
        .args(["rev-list", "--count", "--left-right", &format!("{}...{}@{{u}}", branch_name, branch_name)])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Error obteniendo diferencia de commits: {}", e))?;
    
    let output_str = String::from_utf8_lossy(&diff_output.stdout);
    let parts: Vec<&str> = output_str.trim().split('\t').collect();
    
    let (ahead, behind) = if parts.len() >= 2 {
        let ahead_str = parts[0].trim_start_matches('<').trim();
        let behind_str = parts[1].trim_start_matches('>').trim();
        (
            ahead_str.parse::<i32>().unwrap_or(0),
            behind_str.parse::<i32>().unwrap_or(0),
        )
    } else {
        (0, 0)
    };
    
    log::info!("Estado remoto - ahead: {}, behind: {}", ahead, behind);
    
    Ok(GitRemoteStatus {
        ahead,
        behind,
        has_remote: true,
    })
}
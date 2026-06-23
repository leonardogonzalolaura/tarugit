use git2::{Repository, Sort, Oid};
use std::collections::HashMap;
use tauri::command;

#[derive(serde::Serialize, Debug)]
pub struct GraphNode {
    pub id: String,
    pub message: String,
    pub author: String,
    pub email: String,
    pub timestamp: i64,
    pub parents: Vec<String>,
    pub branches: Vec<String>,
    pub tags: Vec<String>,
}

#[derive(serde::Serialize, Debug)]
pub struct CommitGraph {
    pub nodes: Vec<GraphNode>,
}

#[command]
pub fn get_commit_graph(repo_path: String, max_nodes: Option<usize>) -> Result<CommitGraph, String> {
    log::info!("Obteniendo grafo de commits en: {}", repo_path);
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let limit = max_nodes.unwrap_or(500);

    // Collect all refs: branches and tags pointing to commits
    let mut branch_map: HashMap<Oid, Vec<String>> = HashMap::new();
    let mut tag_map: HashMap<Oid, Vec<String>> = HashMap::new();

    // Local branches
    if let Ok(branches) = repo.branches(Some(git2::BranchType::Local)) {
        for br in branches.flatten() {
            if let Some(name) = br.0.name().ok().flatten() {
                if let Ok(target) = br.0.get().peel_to_commit() {
                    branch_map.entry(target.id()).or_default().push(name.to_string());
                }
            }
        }
    }

    // Remote branches
    if let Ok(branches) = repo.branches(Some(git2::BranchType::Remote)) {
        for br in branches.flatten() {
            if let Some(name) = br.0.name().ok().flatten() {
                if let Ok(target) = br.0.get().peel_to_commit() {
                    branch_map.entry(target.id()).or_default().push(name.to_string());
                }
            }
        }
    }

    // Tags
    if let Ok(tag_names) = repo.tag_names(None) {
        for tag_name in tag_names.iter().flatten() {
            if let Ok(oid) = repo.revparse_single(tag_name) {
                if let Ok(commit) = oid.peel_to_commit() {
                    tag_map.entry(commit.id()).or_default().push(tag_name.to_string());
                }
            }
        }
    }

    // Walk commits
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push_head().map_err(|e| e.to_string())?;
    revwalk.set_sorting(Sort::TIME).map_err(|e| e.to_string())?;

    let mut nodes = Vec::new();
    let mut count = 0;

    for oid_result in revwalk {
        if count >= limit {
            break;
        }
        if let Ok(oid) = oid_result {
            if let Ok(commit) = repo.find_commit(oid) {
                let id = oid.to_string();
                let message = commit.message().unwrap_or("").trim().to_string();
                let author = commit.author().name().unwrap_or("Unknown").to_string();
                let email = commit.author().email().unwrap_or("").to_string();
                let timestamp = commit.time().seconds();

                let parents: Vec<String> = (0..commit.parent_count())
                    .filter_map(|i| commit.parent(i).ok())
                    .map(|p| p.id().to_string())
                    .collect();

                let branches = branch_map.remove(&oid).unwrap_or_default();
                let tags = tag_map.remove(&oid).unwrap_or_default();

                nodes.push(GraphNode {
                    id,
                    message,
                    author,
                    email,
                    timestamp,
                    parents,
                    branches,
                    tags,
                });
                count += 1;
            }
        }
    }

    log::info!("Grafo generado con {} nodos", nodes.len());
    Ok(CommitGraph { nodes })
}

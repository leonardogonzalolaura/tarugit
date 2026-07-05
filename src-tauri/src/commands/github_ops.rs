use std::process::Command;

fn get_owner_repo(repo_path: &str) -> Result<(String, String), String> {
    let output = Command::new("git")
        .args(["remote", "get-url", "origin"])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if !output.status.success() {
        return Err("No remote 'origin' configured".to_string());
    }

    let url = String::from_utf8_lossy(&output.stdout).trim().to_string();
    // Handle various URL formats:
    //   https://github.com/owner/repo.git
    //   git@github.com:owner/repo.git
    //   https://github.com/owner/repo
    let path = url
        .trim_end_matches(".git")
        .replace("git@github.com:", "https://github.com/")
        .replace("https://github.com/", "");

    let parts: Vec<&str> = path.split('/').collect();
    if parts.len() < 2 {
        return Err(format!("Could not parse GitHub owner/repo from URL: {}", url));
    }

    let owner = parts[parts.len() - 2].to_string();
    let repo = parts[parts.len() - 1].to_string();

    if owner.is_empty() || repo.is_empty() {
        return Err(format!("Could not parse GitHub owner/repo from URL: {}", url));
    }

    Ok((owner, repo))
}

#[derive(serde::Serialize)]
pub struct WorkflowRun {
    pub id: i64,
    pub name: String,
    pub head_branch: String,
    pub head_sha: String,
    pub head_commit_message: String,
    pub head_commit_author_name: String,
    pub head_commit_author_email: String,
    pub status: String,
    pub conclusion: Option<String>,
    pub run_number: i64,
    pub created_at: String,
    pub updated_at: String,
    pub html_url: String,
    pub workflow_name: Option<String>,
}

#[derive(serde::Serialize)]
pub struct WorkflowRunJob {
    pub id: i64,
    pub name: String,
    pub status: String,
    pub conclusion: Option<String>,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub steps: Vec<WorkflowRunStep>,
}

#[derive(serde::Serialize)]
pub struct WorkflowRunStep {
    pub name: String,
    pub status: String,
    pub conclusion: Option<String>,
    pub number: i64,
}

#[tauri::command]
pub async fn list_workflow_runs(
    repo_path: String,
    token: String,
    branch: Option<String>,
) -> Result<Vec<WorkflowRun>, String> {
    let (owner, repo) = get_owner_repo(&repo_path)?;

    let client = reqwest::Client::new();
    let mut url = format!(
        "https://api.github.com/repos/{}/{}/actions/runs?per_page=20",
        owner, repo
    );
    if let Some(b) = &branch {
        url.push_str(&format!("&branch={}", b));
    }

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "tarugit")
        .send()
        .await
        .map_err(|e| format!("GitHub API error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("GitHub API returned {}: {}", status, body));
    }

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let runs = body["workflow_runs"]
        .as_array()
        .ok_or("Invalid response: missing workflow_runs")?;

    let result: Vec<WorkflowRun> = runs
        .iter()
        .map(|r| WorkflowRun {
            id: r["id"].as_i64().unwrap_or(0),
            name: r["name"].as_str().unwrap_or("").to_string(),
            head_branch: r["head_branch"].as_str().unwrap_or("").to_string(),
            head_sha: r["head_sha"].as_str().unwrap_or("").to_string(),
            head_commit_message: r["head_commit"]["message"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            head_commit_author_name: r["head_commit"]["author"]["name"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            head_commit_author_email: r["head_commit"]["author"]["email"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            status: r["status"].as_str().unwrap_or("unknown").to_string(),
            conclusion: r["conclusion"].as_str().map(|s| s.to_string()),
            run_number: r["run_number"].as_i64().unwrap_or(0),
            created_at: r["created_at"].as_str().unwrap_or("").to_string(),
            updated_at: r["updated_at"].as_str().unwrap_or("").to_string(),
            html_url: r["html_url"].as_str().unwrap_or("").to_string(),
            workflow_name: r["name"].as_str().map(|s| s.to_string()),
        })
        .collect();

    Ok(result)
}

#[tauri::command]
pub async fn get_workflow_run_jobs(
    repo_path: String,
    run_id: i64,
    token: String,
) -> Result<Vec<WorkflowRunJob>, String> {
    let (owner, repo) = get_owner_repo(&repo_path)?;

    let client = reqwest::Client::new();
    let url = format!(
        "https://api.github.com/repos/{}/{}/actions/runs/{}/jobs?per_page=50",
        owner, repo, run_id
    );

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "tarugit")
        .send()
        .await
        .map_err(|e| format!("GitHub API error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("GitHub API returned {}: {}", status, body));
    }

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let jobs = body["jobs"]
        .as_array()
        .ok_or("Invalid response: missing jobs")?;

    let result: Vec<WorkflowRunJob> = jobs
        .iter()
        .map(|j| WorkflowRunJob {
            id: j["id"].as_i64().unwrap_or(0),
            name: j["name"].as_str().unwrap_or("").to_string(),
            status: j["status"].as_str().unwrap_or("unknown").to_string(),
            conclusion: j["conclusion"].as_str().map(|s| s.to_string()),
            started_at: j["started_at"].as_str().unwrap_or("").to_string(),
            completed_at: j["completed_at"].as_str().map(|s| s.to_string()),
            steps: j["steps"]
                .as_array()
                .map(|steps| {
                    steps
                        .iter()
                        .map(|s| WorkflowRunStep {
                            name: s["name"].as_str().unwrap_or("").to_string(),
                            status: s["status"].as_str().unwrap_or("unknown").to_string(),
                            conclusion: s["conclusion"].as_str().map(|s| s.to_string()),
                            number: s["number"].as_i64().unwrap_or(0),
                        })
                        .collect()
                })
                .unwrap_or_default(),
        })
        .collect();

    Ok(result)
}

#[tauri::command]
pub async fn get_github_remote_info(repo_path: String) -> Result<String, String> {
    let (owner, repo) = get_owner_repo(&repo_path)?;
    Ok(format!("{}/{}", owner, repo))
}

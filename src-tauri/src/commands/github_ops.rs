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

// ─── Pull Requests ──────────────────────────────────────────────────────────

#[derive(serde::Serialize)]
pub struct PullRequestUser {
    pub login: String,
    pub avatar_url: String,
}

#[derive(serde::Serialize)]
pub struct PullRequestRef {
    #[serde(rename = "ref")]
    pub ref_name: String,
    pub sha: String,
}

#[derive(serde::Serialize)]
pub struct PullRequestLabel {
    pub name: String,
    pub color: String,
}

#[derive(serde::Serialize)]
pub struct PullRequest {
    pub number: i64,
    pub title: String,
    pub body: Option<String>,
    pub state: String,
    pub draft: bool,
    pub user: PullRequestUser,
    pub head: PullRequestRef,
    pub base: PullRequestRef,
    pub created_at: String,
    pub updated_at: String,
    pub merged_at: Option<String>,
    pub merge_commit_sha: Option<String>,
    pub html_url: String,
    pub mergeable: Option<bool>,
    pub merged_by: Option<PullRequestUser>,
    pub labels: Vec<PullRequestLabel>,
}

#[derive(serde::Serialize)]
pub struct PullRequestFile {
    pub path: String,
    pub status: String,
    pub additions: i64,
    pub deletions: i64,
}

#[derive(serde::Serialize)]
pub struct PullRequestCommit {
    pub sha: String,
    pub message: String,
    pub author_name: String,
    pub author_email: String,
    pub date: String,
}

#[derive(serde::Serialize)]
pub struct MergeResult {
    pub merged: bool,
    pub message: String,
    pub sha: Option<String>,
}

fn parse_pr_user(val: &serde_json::Value) -> PullRequestUser {
    PullRequestUser {
        login: val["login"].as_str().unwrap_or("").to_string(),
        avatar_url: val["avatar_url"].as_str().unwrap_or("").to_string(),
    }
}

fn parse_pr_ref(val: &serde_json::Value) -> PullRequestRef {
    PullRequestRef {
        ref_name: val["ref"].as_str().unwrap_or("").to_string(),
        sha: val["sha"].as_str().unwrap_or("").to_string(),
    }
}

fn parse_pr(val: &serde_json::Value) -> PullRequest {
    PullRequest {
        number: val["number"].as_i64().unwrap_or(0),
        title: val["title"].as_str().unwrap_or("").to_string(),
        body: val["body"].as_str().map(|s| s.to_string()),
        state: val["state"].as_str().unwrap_or("").to_string(),
        draft: val["draft"].as_bool().unwrap_or(false),
        user: parse_pr_user(&val["user"]),
        head: parse_pr_ref(&val["head"]),
        base: parse_pr_ref(&val["base"]),
        created_at: val["created_at"].as_str().unwrap_or("").to_string(),
        updated_at: val["updated_at"].as_str().unwrap_or("").to_string(),
        merged_at: val["merged_at"].as_str().map(|s| s.to_string()),
        merge_commit_sha: val["merge_commit_sha"].as_str().map(|s| s.to_string()),
        html_url: val["html_url"].as_str().unwrap_or("").to_string(),
        mergeable: val["mergeable"].as_bool(),
        merged_by: val["merged_by"].as_object().map(|_| parse_pr_user(&val["merged_by"])),
        labels: val["labels"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .map(|l| PullRequestLabel {
                        name: l["name"].as_str().unwrap_or("").to_string(),
                        color: l["color"].as_str().unwrap_or("").to_string(),
                    })
                    .collect()
            })
            .unwrap_or_default(),
    }
}

#[tauri::command]
pub async fn list_pull_requests(
    repo_path: String,
    token: String,
    state: Option<String>,
    page: Option<i64>,
) -> Result<Vec<PullRequest>, String> {
    let (owner, repo) = get_owner_repo(&repo_path)?;
    let state = state.unwrap_or_else(|| "open".to_string());
    let page = page.unwrap_or(1);
    let url = format!(
        "https://api.github.com/repos/{}/{}/pulls?state={}&page={}&per_page=20",
        owner, repo, state, page
    );

    let client = reqwest::Client::new();
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

    let items = body
        .as_array()
        .ok_or("Invalid response: expected array")?;

    Ok(items.iter().map(parse_pr).collect())
}

#[tauri::command]
pub async fn get_pull_request(
    repo_path: String,
    token: String,
    number: i64,
) -> Result<PullRequest, String> {
    let (owner, repo) = get_owner_repo(&repo_path)?;
    let url = format!(
        "https://api.github.com/repos/{}/{}/pulls/{}",
        owner, repo, number
    );

    let client = reqwest::Client::new();
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

    let val: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(parse_pr(&val))
}

#[tauri::command]
pub async fn get_pull_request_files(
    repo_path: String,
    token: String,
    number: i64,
) -> Result<Vec<PullRequestFile>, String> {
    let (owner, repo) = get_owner_repo(&repo_path)?;
    let url = format!(
        "https://api.github.com/repos/{}/{}/pulls/{}/files",
        owner, repo, number
    );

    let client = reqwest::Client::new();
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

    let items = body
        .as_array()
        .ok_or("Invalid response: expected array")?;

    Ok(items
        .iter()
        .map(|f| PullRequestFile {
            path: f["filename"].as_str().unwrap_or("").to_string(),
            status: f["status"].as_str().unwrap_or("").to_string(),
            additions: f["additions"].as_i64().unwrap_or(0),
            deletions: f["deletions"].as_i64().unwrap_or(0),
        })
        .collect())
}

#[tauri::command]
pub async fn get_pull_request_commits(
    repo_path: String,
    token: String,
    number: i64,
) -> Result<Vec<PullRequestCommit>, String> {
    let (owner, repo) = get_owner_repo(&repo_path)?;
    let url = format!(
        "https://api.github.com/repos/{}/{}/pulls/{}/commits",
        owner, repo, number
    );

    let client = reqwest::Client::new();
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

    let items = body
        .as_array()
        .ok_or("Invalid response: expected array")?;

    Ok(items
        .iter()
        .map(|c| PullRequestCommit {
            sha: c["sha"].as_str().unwrap_or("").to_string(),
            message: c["commit"]["message"].as_str().unwrap_or("").to_string(),
            author_name: c["commit"]["author"]["name"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            author_email: c["commit"]["author"]["email"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            date: c["commit"]["author"]["date"]
                .as_str()
                .unwrap_or("")
                .to_string(),
        })
        .collect())
}

#[tauri::command]
pub async fn create_pull_request(
    repo_path: String,
    token: String,
    title: String,
    body: Option<String>,
    head: String,
    base: String,
    draft: Option<bool>,
) -> Result<PullRequest, String> {
    let (owner, repo) = get_owner_repo(&repo_path)?;
    let url = format!(
        "https://api.github.com/repos/{}/{}/pulls",
        owner, repo
    );

    let mut payload = serde_json::Map::new();
    payload.insert("title".to_string(), serde_json::Value::String(title));
    payload.insert("head".to_string(), serde_json::Value::String(head));
    payload.insert("base".to_string(), serde_json::Value::String(base));
    if let Some(b) = body {
        payload.insert("body".to_string(), serde_json::Value::String(b));
    }
    if let Some(d) = draft {
        payload.insert("draft".to_string(), serde_json::Value::Bool(d));
    }

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "tarugit")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("GitHub API error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("GitHub API returned {}: {}", status, body));
    }

    let val: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(parse_pr(&val))
}

#[tauri::command]
pub async fn merge_pull_request(
    repo_path: String,
    token: String,
    number: i64,
    method: String,
) -> Result<MergeResult, String> {
    let (owner, repo) = get_owner_repo(&repo_path)?;
    let url = format!(
        "https://api.github.com/repos/{}/{}/pulls/{}/merge",
        owner, repo, number
    );

    let mut payload = serde_json::Map::new();
    payload.insert(
        "merge_method".to_string(),
        serde_json::Value::String(method),
    );

    let client = reqwest::Client::new();
    let resp = client
        .put(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "tarugit")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("GitHub API error: {}", e))?;

    let status_code = resp.status();
    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    if !status_code.is_success() {
        let msg = body["message"]
            .as_str()
            .unwrap_or("Unknown error")
            .to_string();
        return Err(format!("Merge failed ({}): {}", status_code, msg));
    }

    Ok(MergeResult {
        merged: body["merged"].as_bool().unwrap_or(false),
        message: body["message"].as_str().unwrap_or("").to_string(),
        sha: body["sha"].as_str().map(|s| s.to_string()),
    })
}

#[derive(serde::Serialize)]
pub struct PrReadiness {
    pub ahead_by: i64,
    pub behind_by: i64,
    pub has_existing_pr: bool,
    pub existing_pr_number: Option<i64>,
    pub existing_pr_title: Option<String>,
    pub mergeable: Option<bool>,
}

#[tauri::command]
pub async fn check_pr_readiness(
    repo_path: String,
    token: String,
    head: String,
    base: String,
) -> Result<PrReadiness, String> {
    let (owner, repo) = get_owner_repo(&repo_path)?;

    let client = reqwest::Client::new();

    // Check existing PRs with same head and base
    let existing_url = format!(
        "https://api.github.com/repos/{}/{}/pulls?head={}:{}&base={}&state=open",
        owner, repo, owner, head, base
    );

    let existing_resp = client
        .get(&existing_url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "tarugit")
        .send()
        .await
        .map_err(|e| format!("GitHub API error: {}", e))?;

    let existing_body: serde_json::Value = existing_resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let existing_prs = existing_body.as_array();
    let has_existing_pr = existing_prs.map(|arr| !arr.is_empty()).unwrap_or(false);
    let existing_pr_number = existing_prs.and_then(|arr| arr.first()).and_then(|pr| pr["number"].as_i64());
    let existing_pr_title = existing_prs.and_then(|arr| arr.first()).and_then(|pr| pr["title"].as_str().map(|s| s.to_string()));

    // Compare branches
    let compare_url = format!(
        "https://api.github.com/repos/{}/{}/compare/{}...{}",
        owner, repo, base, head
    );

    let compare_resp = client
        .get(&compare_url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "tarugit")
        .send()
        .await
        .map_err(|e| format!("GitHub API error: {}", e))?;

    if !compare_resp.status().is_success() {
        return Ok(PrReadiness {
            ahead_by: 0,
            behind_by: 0,
            has_existing_pr,
            existing_pr_number,
            existing_pr_title,
            mergeable: None,
        });
    }

    let compare_body: serde_json::Value = compare_resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(PrReadiness {
        ahead_by: compare_body["ahead_by"].as_i64().unwrap_or(0),
        behind_by: compare_body["behind_by"].as_i64().unwrap_or(0),
        has_existing_pr,
        existing_pr_number,
        existing_pr_title,
        mergeable: compare_body["mergeable"].as_bool(),
    })
}

#[tauri::command]
pub async fn update_pull_request(
    repo_path: String,
    token: String,
    number: i64,
    state: String,
) -> Result<PullRequest, String> {
    let (owner, repo) = get_owner_repo(&repo_path)?;
    let url = format!(
        "https://api.github.com/repos/{}/{}/pulls/{}",
        owner, repo, number
    );

    let mut payload = serde_json::Map::new();
    payload.insert("state".to_string(), serde_json::Value::String(state));

    let client = reqwest::Client::new();
    let resp = client
        .patch(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "tarugit")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("GitHub API error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("GitHub API returned {}: {}", status, body));
    }

    let val: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(parse_pr(&val))
}

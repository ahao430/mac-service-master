use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

/// Returns the current platform: "macos", "windows", or "linux"
fn get_current_platform() -> &'static str {
    if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else {
        "linux"
    }
}

#[tauri::command]
fn get_platform() -> String {
    get_current_platform().to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LaunchAgent {
    pub label: String,
    pub program: Option<String>,
    pub program_arguments: Option<Vec<String>>,
    pub run_at_load: Option<bool>,
    pub keep_alive: Option<bool>,
    pub working_directory: Option<String>,
    pub standard_out_path: Option<String>,
    pub standard_error_path: Option<String>,
    pub environment_variables: Option<HashMap<String, String>>,
    pub file_path: String,
    pub is_loaded: bool,
    pub pid: Option<i32>,
    // Metadata fields
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub port: Option<u16>,
    pub health_url: Option<String>,
    pub order: Option<i32>,
    pub project_path: Option<String>,
    pub app_path: Option<String>, // 用于标识是否为应用模式
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ServiceMetadata {
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub port: Option<u16>,
    pub health_url: Option<String>,
    pub order: Option<i32>,
    pub project_path: Option<String>,
    pub app_path: Option<String>, // 用于标识是否为应用模式
}

/// Preset service template
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PresetService {
    pub label: String,
    pub display_name: String,
    pub description: String,
    pub icon: String,
    pub program: Option<String>,
    pub program_arguments: Option<Vec<String>>,
    pub working_directory: Option<String>,
    pub port: Option<u16>,
    pub health_url: Option<String>,
    pub run_at_load: bool,
    pub keep_alive: bool,
    pub app_path: Option<String>, // 新增：用于标识是否为应用模式
}

/// Get built-in preset services
fn get_preset_services() -> Vec<PresetService> {
    vec![
        PresetService {
            label: "com.user.cliproxy".to_string(),
            display_name: "CLIProxy".to_string(),
            description: "CLI 代理服务 - API 转发中转".to_string(),
            icon: "globe".to_string(),
            program: None,
            program_arguments: Some(vec!["./cli-proxy-api".to_string()]),
            working_directory: None, // User needs to set this
            port: Some(8317),
            health_url: Some("http://127.0.0.1:8317/management.html".to_string()),
            run_at_load: true,
            keep_alive: true,
            app_path: None,
        },
        PresetService {
            label: "com.user.openwebui".to_string(),
            display_name: "OpenWebUI".to_string(),
            description: "开源 AI 对话界面".to_string(),
            icon: "terminal".to_string(),
            program: None,
            program_arguments: Some(vec!["open-webui".to_string(), "serve".to_string()]),
            working_directory: None,
            port: Some(3000),
            health_url: Some("http://127.0.0.1:8080".to_string()),
            run_at_load: true,
            keep_alive: true,
            app_path: None,
        },
        PresetService {
            label: "com.user.antigravitytools".to_string(),
            display_name: "AntigravityTools".to_string(),
            description: "Antigravity 开发工具".to_string(),
            icon: "cpu".to_string(),
            program: Some("open".to_string()),
            program_arguments: Some(vec!["-a".to_string(), "AntigravityTools".to_string()]),
            working_directory: None,
            port: None,
            health_url: None,
            run_at_load: false,
            keep_alive: false,
            app_path: Some("AntigravityTools".to_string()),
        },
    ]
}

#[tauri::command]
fn get_presets() -> Vec<PresetService> {
    get_preset_services()
}

fn get_metadata_file_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| dirs::home_dir().expect("Could not find home directory").join(".config"))
        .join("service-master")
        .join("metadata.json")
}

fn load_all_metadata() -> HashMap<String, ServiceMetadata> {
    let path = get_metadata_file_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(metadata) = serde_json::from_str(&content) {
                return metadata;
            }
        }
    }
    HashMap::new()
}

fn save_all_metadata(metadata: &HashMap<String, ServiceMetadata>) -> Result<(), String> {
    let path = get_metadata_file_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(metadata).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

fn get_launch_agents_dir() -> PathBuf {
    let settings_path = get_settings_file_path();
    if settings_path.exists() {
        if let Ok(content) = fs::read_to_string(&settings_path) {
            if let Ok(settings) = serde_json::from_str::<AppSettings>(&content) {
                if let Some(path) = settings.config_path {
                    let p = PathBuf::from(path);
                    if p.exists() && p.is_dir() {
                        return p;
                    }
                }
            }
        }
    }

    // Platform-specific default paths
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir()
            .expect("Could not find home directory")
            .join("Library")
            .join("LaunchAgents")
    }

    #[cfg(target_os = "windows")]
    {
        // On Windows, use a custom services config directory
        dirs::config_dir()
            .unwrap_or_else(|| dirs::home_dir().expect("Could not find home directory"))
            .join("service-master")
            .join("services")
    }

    #[cfg(target_os = "linux")]
    {
        // On Linux, use systemd user units directory
        dirs::home_dir()
            .expect("Could not find home directory")
            .join(".config")
            .join("systemd")
            .join("user")
    }
}

fn parse_plist_file(path: &PathBuf) -> Option<LaunchAgent> {
    let value: plist::Value = plist::from_file(path).ok()?;
    let dict = value.as_dictionary()?;

    let label = dict.get("Label")?.as_string()?.to_string();

    let program = dict.get("Program").and_then(|v| v.as_string().map(String::from));

    let program_arguments = dict.get("ProgramArguments").and_then(|v| {
        v.as_array().map(|arr| {
            arr.iter()
                .filter_map(|item| item.as_string().map(String::from))
                .collect()
        })
    });

    let run_at_load = dict.get("RunAtLoad").and_then(|v| v.as_boolean());
    let keep_alive = dict.get("KeepAlive").and_then(|v| v.as_boolean());
    let working_directory = dict
        .get("WorkingDirectory")
        .and_then(|v| v.as_string().map(String::from));
    let standard_out_path = dict
        .get("StandardOutPath")
        .and_then(|v| v.as_string().map(String::from));
    let standard_error_path = dict
        .get("StandardErrorPath")
        .and_then(|v| v.as_string().map(String::from));

    let environment_variables = dict.get("EnvironmentVariables").and_then(|v| {
        v.as_dictionary().map(|d| {
            d.iter()
                .filter_map(|(k, v)| v.as_string().map(|s| (k.clone(), s.to_string())))
                .collect()
        })
    });

    Some(LaunchAgent {
        label,
        program,
        program_arguments,
        run_at_load,
        keep_alive,
        working_directory,
        standard_out_path,
        standard_error_path,
        environment_variables,
        file_path: path.to_string_lossy().to_string(),
        is_loaded: false,
        pid: None,
        display_name: None,
        description: None,
        icon: None,
        port: None,
        health_url: None,
        order: None,
        project_path: None,
        app_path: None,
    })
}

fn get_loaded_services() -> HashMap<String, Option<i32>> {
    let mut services = HashMap::new();

    #[cfg(target_os = "macos")]
    {
        let output = Command::new("launchctl")
            .args(["list"])
            .output()
            .ok();

        if let Some(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines().skip(1) {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 3 {
                    let pid = parts[0].parse::<i32>().ok();
                    let label = parts[2].to_string();
                    services.insert(label, pid);
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        // On Windows, query running services using sc query or tasklist
        // For now, return empty - Windows services work differently
        // Users can check process status via port checking
    }

    #[cfg(target_os = "linux")]
    {
        // On Linux, use systemctl --user list-units
        let output = Command::new("systemctl")
            .args(["--user", "list-units", "--type=service", "--no-pager", "--plain"])
            .output()
            .ok();

        if let Some(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines().skip(1) {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if !parts.is_empty() {
                    let label = parts[0].trim_end_matches(".service").to_string();
                    services.insert(label, None); // systemctl doesn't show PID in list
                }
            }
        }
    }

    services
}

#[tauri::command]
fn get_services() -> Result<Vec<LaunchAgent>, String> {
    let agents_dir = get_launch_agents_dir();

    if !agents_dir.exists() {
        return Ok(vec![]);
    }

    let loaded_services = get_loaded_services();
    let all_metadata = load_all_metadata();

    let entries = fs::read_dir(&agents_dir).map_err(|e| e.to_string())?;

    let mut agents: Vec<LaunchAgent> = vec![];

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "plist") {
                if let Some(mut agent) = parse_plist_file(&path) {
                    if let Some(pid) = loaded_services.get(&agent.label) {
                        agent.is_loaded = true;
                        agent.pid = *pid;
                    }
                    // Apply metadata
                    if let Some(meta) = all_metadata.get(&agent.label) {
                        agent.display_name = meta.display_name.clone();
                        agent.description = meta.description.clone();
                        agent.icon = meta.icon.clone();
                        agent.port = meta.port;
                        agent.health_url = meta.health_url.clone();
                        agent.order = meta.order;
                        agent.project_path = meta.project_path.clone();
                        agent.app_path = meta.app_path.clone();
                    }
                    agents.push(agent);
                }
            }
        }
    }

    agents.sort_by(|a, b| match (a.order, b.order) {
        (Some(ao), Some(bo)) => ao.cmp(&bo),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => a.label.cmp(&b.label),
    });

    Ok(agents)
}

#[tauri::command]
fn load_service(plist_path: String) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("launchctl")
            .args(["load", &plist_path])
            .output()
            .map_err(|e| e.to_string())?;

        if output.status.success() {
            Ok("Service loaded successfully".to_string())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }

    #[cfg(target_os = "windows")]
    {
        // On Windows, we start the process directly based on config
        Err("Windows service loading not yet implemented. Please start the process manually.".to_string())
    }

    #[cfg(target_os = "linux")]
    {
        let service_name = std::path::Path::new(&plist_path)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();

        let output = Command::new("systemctl")
            .args(["--user", "start", &service_name])
            .output()
            .map_err(|e| e.to_string())?;

        if output.status.success() {
            Ok("Service started successfully".to_string())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }
}

#[tauri::command]
fn unload_service(plist_path: String) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("launchctl")
            .args(["unload", &plist_path])
            .output()
            .map_err(|e| e.to_string())?;

        if output.status.success() {
            Ok("Service unloaded successfully".to_string())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }

    #[cfg(target_os = "windows")]
    {
        Err("Windows service unloading not yet implemented.".to_string())
    }

    #[cfg(target_os = "linux")]
    {
        let service_name = std::path::Path::new(&plist_path)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();

        let output = Command::new("systemctl")
            .args(["--user", "stop", &service_name])
            .output()
            .map_err(|e| e.to_string())?;

        if output.status.success() {
            Ok("Service stopped successfully".to_string())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }
}

#[tauri::command]
fn restart_service(plist_path: String) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        // First unload
        let _ = Command::new("launchctl")
            .args(["unload", &plist_path])
            .output();

        // Then load
        let output = Command::new("launchctl")
            .args(["load", &plist_path])
            .output()
            .map_err(|e| e.to_string())?;

        if output.status.success() {
            Ok("Service restarted successfully".to_string())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }

    #[cfg(target_os = "windows")]
    {
        Err("Windows service restart not yet implemented.".to_string())
    }

    #[cfg(target_os = "linux")]
    {
        let service_name = std::path::Path::new(&plist_path)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();

        let output = Command::new("systemctl")
            .args(["--user", "restart", &service_name])
            .output()
            .map_err(|e| e.to_string())?;

        if output.status.success() {
            Ok("Service restarted successfully".to_string())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }
}

#[tauri::command]
fn get_service_logs(log_path: String, lines: usize) -> Result<Vec<String>, String> {
    let content = fs::read_to_string(&log_path).map_err(|e| e.to_string())?;
    let all_lines: Vec<&str> = content.lines().collect();
    let start = if all_lines.len() > lines {
        all_lines.len() - lines
    } else {
        0
    };
    Ok(all_lines[start..].iter().map(|s| s.to_string()).collect())
}

#[tauri::command]
fn clear_service_logs(log_path: String) -> Result<String, String> {
    fs::write(&log_path, "").map_err(|e| e.to_string())?;
    Ok("Logs cleared successfully".to_string())
}

#[tauri::command]
fn get_process_by_port(port: u16) -> Result<Option<i32>, String> {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("lsof")
            .args(["-i", &format!(":{}", port), "-t", "-sTCP:LISTEN"])
            .output()
            .map_err(|e| e.to_string())?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Some(line) = stdout.lines().next() {
            if let Ok(pid) = line.trim().parse::<i32>() {
                return Ok(Some(pid));
            }
        }
        Ok(None)
    }

    #[cfg(target_os = "windows")]
    {
        // Use netstat on Windows
        let output = Command::new("cmd")
            .args(["/C", &format!("netstat -ano | findstr :{} | findstr LISTENING", port)])
            .output()
            .map_err(|e| e.to_string())?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Some(line) = stdout.lines().next() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if let Some(pid_str) = parts.last() {
                if let Ok(pid) = pid_str.trim().parse::<i32>() {
                    return Ok(Some(pid));
                }
            }
        }
        Ok(None)
    }

    #[cfg(target_os = "linux")]
    {
        let output = Command::new("lsof")
            .args(["-i", &format!(":{}", port), "-t", "-sTCP:LISTEN"])
            .output()
            .map_err(|e| e.to_string())?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Some(line) = stdout.lines().next() {
            if let Ok(pid) = line.trim().parse::<i32>() {
                return Ok(Some(pid));
            }
        }
        Ok(None)
    }
}

#[tauri::command]
fn kill_process(pid: i32) -> Result<String, String> {
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        let output = Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output()
            .map_err(|e| e.to_string())?;

        if output.status.success() {
            Ok("Process killed successfully".to_string())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }

    #[cfg(target_os = "windows")]
    {
        let output = Command::new("taskkill")
            .args(["/F", "/PID", &pid.to_string()])
            .output()
            .map_err(|e| e.to_string())?;

        if output.status.success() {
            Ok("Process killed successfully".to_string())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }
}

#[tauri::command]
fn check_port(port: u16) -> Result<bool, String> {
    let addr = format!("127.0.0.1:{}", port);
    match TcpStream::connect_timeout(
        &addr.parse().map_err(|e: std::net::AddrParseError| e.to_string())?,
        Duration::from_millis(500),
    ) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
fn check_health(url: String) -> Result<bool, String> {
    // Try using reqwest first (cross-platform)
    #[cfg(feature = "native-tls")]
    {
        match reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
        {
            Ok(client) => {
                match client.get(&url).send() {
                    Ok(response) => {
                        let status = response.status().as_u16();
                        return Ok((200..400).contains(&status));
                    }
                    Err(_) => return Ok(false),
                }
            }
            Err(_) => {}
        }
    }

    // Fallback to curl on Unix systems
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        let output = Command::new("curl")
            .args(["-s", "-o", "/dev/null", "-w", "%{http_code}", "-m", "2", &url])
            .output()
            .map_err(|e| e.to_string())?;

        let status_code = String::from_utf8_lossy(&output.stdout);
        return Ok(status_code.starts_with('2') || status_code.starts_with('3'));
    }

    #[cfg(target_os = "windows")]
    {
        // Fallback for Windows without reqwest
        Ok(false)
    }
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn check_app_running(app_name: String) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        // 使用 AppleScript 获取所有进程名，然后在 Rust 中进行大小写不敏感的匹配
        let script = "tell application \"System Events\" to name of processes";
        let output = Command::new("osascript")
            .arg("-e")
            .arg(script)
            .output()
            .map_err(|e| e.to_string())?;

        if output.status.success() {
            let processes = String::from_utf8_lossy(&output.stdout);
            let app_name_lower = app_name.to_lowercase().replace(" ", "").replace("-", "").replace("_", "");

            // 检查进程列表中是否有匹配的应用（忽略大小写、空格、下划线、连字符）
            for process in processes.split(',') {
                let process_name = process.trim();
                let process_normalized = process_name.to_lowercase().replace(" ", "").replace("-", "").replace("_", "");

                if process_normalized.contains(&app_name_lower) || app_name_lower.contains(&process_normalized) {
                    return Ok(true);
                }
            }
            Ok(false)
        } else {
            Ok(false)
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Windows: 使用 tasklist 命令检查进程
        let output = Command::new("tasklist")
            .arg("/FI")
            .arg(format!("IMAGENAME eq {}.exe", app_name))
            .arg("/NH")
            .output()
            .map_err(|e| e.to_string())?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // 如果找到进程，tasklist 会输出进程信息
            Ok(stdout.contains(&app_name))
        } else {
            Ok(false)
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Linux: 使用 pgrep 命令检查进程
        let output = Command::new("pgrep")
            .arg("-f")
            .arg(&app_name)
            .output()
            .map_err(|e| e.to_string())?;

        // pgrep 成功且有输出表示进程在运行
        Ok(output.status.success() && !output.stdout.is_empty())
    }
}

#[tauri::command]
fn quit_app(app_name: String) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        // 首先尝试使用 AppleScript 关闭 GUI 应用
        let applescript_output = Command::new("osascript")
            .arg("-e")
            .arg(format!("quit app \"{}\"", app_name))
            .output()
            .map_err(|e| e.to_string())?;

        // 如果 AppleScript 成功，返回
        if applescript_output.status.success() {
            return Ok("Application quit successfully".to_string());
        }

        // 如果 AppleScript 失败（可能是命令行进程），使用 pkill
        let pkill_output = Command::new("pkill")
            .arg("-f")
            .arg(&app_name)
            .output()
            .map_err(|e| e.to_string())?;

        if pkill_output.status.success() {
            Ok("Application quit successfully".to_string())
        } else {
            // 两种方法都失败了
            let applescript_stderr = String::from_utf8_lossy(&applescript_output.stderr);
            let pkill_stderr = String::from_utf8_lossy(&pkill_output.stderr);
            Err(format!(
                "Failed to quit application. AppleScript: {}, pkill: {}",
                applescript_stderr, pkill_stderr
            ))
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Windows: 使用 taskkill 命令关闭应用
        let output = Command::new("taskkill")
            .arg("/IM")
            .arg(format!("{}.exe", app_name))
            .arg("/F")
            .output()
            .map_err(|e| e.to_string())?;

        if output.status.success() {
            Ok("Application quit successfully".to_string())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Failed to quit application: {}", stderr))
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Linux: 使用 pkill 命令关闭应用
        let output = Command::new("pkill")
            .arg("-f")
            .arg(&app_name)
            .output()
            .map_err(|e| e.to_string())?;

        if output.status.success() {
            Ok("Application quit successfully".to_string())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Failed to quit application: {}", stderr))
        }
    }
}

#[tauri::command]
fn save_service_metadata(label: String, metadata: ServiceMetadata) -> Result<String, String> {
    let mut all_metadata = load_all_metadata();
    all_metadata.insert(label, metadata);
    save_all_metadata(&all_metadata)?;
    Ok("Metadata saved successfully".to_string())
}

#[tauri::command]
fn get_service_metadata(label: String) -> Result<Option<ServiceMetadata>, String> {
    let all_metadata = load_all_metadata();
    Ok(all_metadata.get(&label).cloned())
}

#[tauri::command]
fn get_all_metadata_map() -> Result<HashMap<String, ServiceMetadata>, String> {
    Ok(load_all_metadata())
}

#[tauri::command]
fn import_metadata(metadata: HashMap<String, ServiceMetadata>) -> Result<String, String> {
    let mut current = load_all_metadata();
    for (k, v) in metadata {
        current.insert(k, v);
    }
    save_all_metadata(&current)?;
    Ok("Metadata imported successfully".to_string())
}

#[tauri::command]
fn update_services_order(orders: HashMap<String, i32>) -> Result<String, String> {
    let mut all_metadata = load_all_metadata();
    for (label, order) in orders {
        all_metadata.entry(label).and_modify(|m| m.order = Some(order)).or_insert_with(|| {
            let mut m = ServiceMetadata::default();
            m.order = Some(order);
            m
        });
    }
    save_all_metadata(&all_metadata)?;
    Ok("Order updated successfully".to_string())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub theme_color: String,
    pub opacity: f32,
    pub config_path: Option<String>,
    pub theme_mode: String,
    pub webdav_url: Option<String>,
    pub webdav_username: Option<String>,
    pub webdav_password: Option<String>,
    pub auto_launch: Option<bool>, // 新增：开机自启动
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme_color: "#3b82f6".to_string(),
            opacity: 0.8,
            config_path: None,
            theme_mode: "auto".to_string(),
            webdav_url: None,
            webdav_username: None,
            webdav_password: None,
            auto_launch: Some(false),
        }
    }
}

fn get_settings_file_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| dirs::home_dir().expect("Could not find home directory").join(".config"))
        .join("service-master")
        .join("settings.json")
}

#[tauri::command]
fn get_app_settings() -> Result<AppSettings, String> {
    let path = get_settings_file_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(settings) = serde_json::from_str(&content) {
                return Ok(settings);
            }
        }
    }
    Ok(AppSettings::default())
}

#[tauri::command]
fn save_app_settings(settings: AppSettings) -> Result<String, String> {
    let path = get_settings_file_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok("Settings saved successfully".to_string())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ServiceConfig {
    pub label: String,
    pub program: Option<String>,
    pub program_arguments: Option<Vec<String>>,
    pub run_at_load: Option<bool>,
    pub keep_alive: Option<bool>,
    pub working_directory: Option<String>,
    pub standard_out_path: Option<String>,
    pub standard_error_path: Option<String>,
    pub environment_variables: Option<HashMap<String, String>>,
}

#[tauri::command]
fn create_service(config: ServiceConfig) -> Result<String, String> {
    let agents_dir = get_launch_agents_dir();

    // Ensure directory exists
    if !agents_dir.exists() {
        fs::create_dir_all(&agents_dir).map_err(|e| e.to_string())?;
    }

    // Create plist dictionary
    let mut dict = plist::Dictionary::new();
    dict.insert("Label".to_string(), plist::Value::String(config.label.clone()));

    if let Some(program) = &config.program {
        dict.insert("Program".to_string(), plist::Value::String(program.clone()));
    }

    if let Some(args) = &config.program_arguments {
        let arr: Vec<plist::Value> = args.iter()
            .map(|s| plist::Value::String(s.clone()))
            .collect();
        dict.insert("ProgramArguments".to_string(), plist::Value::Array(arr));
    }

    if let Some(run_at_load) = config.run_at_load {
        dict.insert("RunAtLoad".to_string(), plist::Value::Boolean(run_at_load));
    }

    if let Some(keep_alive) = config.keep_alive {
        dict.insert("KeepAlive".to_string(), plist::Value::Boolean(keep_alive));
    }

    if let Some(working_dir) = &config.working_directory {
        dict.insert("WorkingDirectory".to_string(), plist::Value::String(working_dir.clone()));
    }

    if let Some(stdout) = &config.standard_out_path {
        dict.insert("StandardOutPath".to_string(), plist::Value::String(stdout.clone()));
    }

    if let Some(stderr) = &config.standard_error_path {
        dict.insert("StandardErrorPath".to_string(), plist::Value::String(stderr.clone()));
    }

    if let Some(env_vars) = &config.environment_variables {
        let mut env_dict = plist::Dictionary::new();
        for (k, v) in env_vars {
            env_dict.insert(k.clone(), plist::Value::String(v.clone()));
        }
        dict.insert("EnvironmentVariables".to_string(), plist::Value::Dictionary(env_dict));
    }

    // Write to file
    let file_path = agents_dir.join(format!("{}.plist", config.label));
    let value = plist::Value::Dictionary(dict);
    plist::to_file_xml(&file_path, &value).map_err(|e| e.to_string())?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn update_service(file_path: String, config: ServiceConfig) -> Result<String, String> {
    let path = PathBuf::from(&file_path);

    if !path.exists() {
        return Err("Service file not found".to_string());
    }

    // First unload if loaded (macOS only)
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("launchctl")
            .args(["unload", &file_path])
            .output();
    }

    #[cfg(target_os = "linux")]
    {
        let service_name = path.file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        let _ = Command::new("systemctl")
            .args(["--user", "stop", &service_name])
            .output();
    }

    // Create new plist dictionary
    let mut dict = plist::Dictionary::new();
    dict.insert("Label".to_string(), plist::Value::String(config.label.clone()));

    if let Some(program) = &config.program {
        dict.insert("Program".to_string(), plist::Value::String(program.clone()));
    }

    if let Some(args) = &config.program_arguments {
        let arr: Vec<plist::Value> = args.iter()
            .map(|s| plist::Value::String(s.clone()))
            .collect();
        dict.insert("ProgramArguments".to_string(), plist::Value::Array(arr));
    }

    if let Some(run_at_load) = config.run_at_load {
        dict.insert("RunAtLoad".to_string(), plist::Value::Boolean(run_at_load));
    }

    if let Some(keep_alive) = config.keep_alive {
        dict.insert("KeepAlive".to_string(), plist::Value::Boolean(keep_alive));
    }

    if let Some(working_dir) = &config.working_directory {
        dict.insert("WorkingDirectory".to_string(), plist::Value::String(working_dir.clone()));
    }

    if let Some(stdout) = &config.standard_out_path {
        dict.insert("StandardOutPath".to_string(), plist::Value::String(stdout.clone()));
    }

    if let Some(stderr) = &config.standard_error_path {
        dict.insert("StandardErrorPath".to_string(), plist::Value::String(stderr.clone()));
    }

    if let Some(env_vars) = &config.environment_variables {
        let mut env_dict = plist::Dictionary::new();
        for (k, v) in env_vars {
            env_dict.insert(k.clone(), plist::Value::String(v.clone()));
        }
        dict.insert("EnvironmentVariables".to_string(), plist::Value::Dictionary(env_dict));
    }

    // Write to file
    let value = plist::Value::Dictionary(dict);
    plist::to_file_xml(&path, &value).map_err(|e| e.to_string())?;

    Ok("Service updated successfully".to_string())
}

#[tauri::command]
fn delete_service(file_path: String) -> Result<String, String> {
    let path = PathBuf::from(&file_path);

    if !path.exists() {
        return Err("Service file not found".to_string());
    }

    // First unload if loaded (platform-specific)
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("launchctl")
            .args(["unload", &file_path])
            .output();
    }

    #[cfg(target_os = "linux")]
    {
        let service_name = path.file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        let _ = Command::new("systemctl")
            .args(["--user", "stop", &service_name])
            .output();
        let _ = Command::new("systemctl")
            .args(["--user", "disable", &service_name])
            .output();
    }

    // Delete the file
    fs::remove_file(&path).map_err(|e| e.to_string())?;

    Ok("Service deleted successfully".to_string())
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// WebDAV sync data structure
#[derive(Debug, Serialize, Deserialize)]
pub struct WebDavSyncData {
    pub metadata: HashMap<String, ServiceMetadata>,
    pub settings: AppSettings,
    pub sync_time: String,
}

/// Build WebDAV authorization header
fn build_webdav_auth(username: &str, password: &str) -> String {
    let credentials = format!("{}:{}", username, password);
    format!("Basic {}", BASE64.encode(credentials.as_bytes()))
}

/// Get the WebDAV file URL for sync
fn get_webdav_sync_url(base_url: &str) -> String {
    let mut url = base_url.trim_end_matches('/').to_string();
    url.push_str("/service-master-sync.json");
    url
}

/// Get the WebDAV directory URL
fn get_webdav_dir_url(base_url: &str) -> String {
    base_url.trim_end_matches('/').to_string()
}

/// Try to create WebDAV directory using MKCOL
fn ensure_webdav_directory(client: &reqwest::blocking::Client, base_url: &str, auth: &str) -> Result<(), String> {
    let dir_url = get_webdav_dir_url(base_url);

    // First check if directory exists with PROPFIND
    let check_response = client
        .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &dir_url)
        .header("Authorization", auth)
        .header("Depth", "0")
        .send();

    if let Ok(resp) = check_response {
        if resp.status().is_success() || resp.status().as_u16() == 207 {
            return Ok(()); // Directory exists
        }
    }

    // Try to create directory with MKCOL
    let mkcol_response = client
        .request(reqwest::Method::from_bytes(b"MKCOL").unwrap(), &dir_url)
        .header("Authorization", auth)
        .send()
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    let status = mkcol_response.status().as_u16();
    if status == 201 || status == 405 || status == 409 {
        // 201 = Created, 405 = Already exists, 409 = Conflict (parent exists)
        Ok(())
    } else {
        Err(format!("Failed to create WebDAV directory: {}", status))
    }
}

#[tauri::command]
fn test_webdav_connection(url: String, username: String, password: String) -> Result<String, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let auth = build_webdav_auth(&username, &password);

    // Use PROPFIND to test WebDAV connection
    let response = client
        .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &url)
        .header("Authorization", &auth)
        .header("Depth", "0")
        .send()
        .map_err(|e| format!("Connection failed: {}", e))?;

    let status = response.status();
    if status.is_success() || status.as_u16() == 207 {
        Ok("Connection successful".to_string())
    } else if status.as_u16() == 401 {
        Err("Authentication failed: incorrect username or password".to_string())
    } else if status.as_u16() == 404 {
        Err("Path not found: check WebDAV URL".to_string())
    } else {
        Err(format!("Connection failed with status: {}", status))
    }
}

/// Helper function to gather and serialize sync data
fn get_sync_data() -> Result<String, String> {
    let metadata = load_all_metadata();
    let settings_path = get_settings_file_path();
    let settings: AppSettings = if settings_path.exists() {
        fs::read_to_string(&settings_path)
            .ok()
            .and_then(|content| serde_json::from_str(&content).ok())
            .unwrap_or_default()
    } else {
        AppSettings::default()
    };

    let sync_data = WebDavSyncData {
        metadata,
        settings,
        sync_time: chrono_now(),
    };

    serde_json::to_string_pretty(&sync_data)
        .map_err(|e| format!("Failed to serialize data: {}", e))
}

/// Helper function to upload data to a WebDAV URL
fn do_webdav_upload(client: &reqwest::blocking::Client, url: &str, auth: &str, data: &str) -> Result<String, String> {
    eprintln!("Uploading {} bytes to: {}", data.len(), url);

    let response = client
        .put(url)
        .header("Authorization", auth)
        .header("Content-Type", "application/json; charset=utf-8")
        .body(data.to_string())
        .send()
        .map_err(|e| format!("Upload failed: {}", e))?;

    let status_code = response.status().as_u16();
    eprintln!("WebDAV response status: {}", status_code);

    match status_code {
        200 | 201 | 204 => Ok("同步成功！".to_string()),
        401 => Err("认证失败，请检查用户名和密码".to_string()),
        404 => Err("上传失败 (404): WebDAV 目录不存在。\n\n对于坚果云，请先在网页端创建一个文件夹（如 service-master），然后使用完整路径：\nhttps://dav.jianguoyun.com/dav/service-master/".to_string()),
        405 => Err("不支持的操作 (405)，该 WebDAV 服务器可能不允许在此路径上传文件".to_string()),
        _ => {
            let body = response.text().unwrap_or_default();
            Err(format!("上传失败 ({}): {}", status_code, body))
        }
    }
}

#[tauri::command]
fn sync_to_webdav(url: String, username: String, password: String) -> Result<String, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let auth = build_webdav_auth(&username, &password);

    // Get sync data first
    let json_content = get_sync_data()?;

    // Check if we're using Jianguoyun root path
    let normalized_url = url.trim_end_matches('/');
    let is_jianguoyun_root = normalized_url.ends_with("/dav") || normalized_url == "https://dav.jianguoyun.com/dav";

    if is_jianguoyun_root {
        eprintln!("Detected Jianguoyun root path, attempting to create service-master directory...");

        // Try to create /dav/service-master/ directory using MKCOL
        let dir_url = format!("{}/service-master", normalized_url);

        let mkcol_result = client
            .request(reqwest::Method::from_bytes(b"MKCOL").unwrap(), &dir_url)
            .header("Authorization", &auth)
            .send();

        if let Ok(resp) = mkcol_result {
            let mkcol_status = resp.status().as_u16();
            eprintln!("MKCOL response: {}", mkcol_status);

            // 201 = created, 405 = already exists, 301 = redirect (already exists)
            if mkcol_status == 201 || mkcol_status == 405 || mkcol_status == 301 {
                // Directory created or exists, upload to it
                let new_sync_url = format!("{}/service-master-sync.json", dir_url);
                return do_webdav_upload(&client, &new_sync_url, &auth, &json_content);
            }
        }

        // If MKCOL failed, still try the original path but give a helpful error
        let sync_url = get_webdav_sync_url(&url);
        let result = do_webdav_upload(&client, &sync_url, &auth, &json_content);

        if result.is_err() {
            return Err("无法在坚果云根目录创建文件。\n\n请按以下步骤操作：\n1. 登录 jianguoyun.com\n2. 创建一个文件夹（如 service-master）\n3. 将服务器地址改为：\n   https://dav.jianguoyun.com/dav/service-master/\n4. 保存设置后重试".to_string());
        }
        return result;
    }

    // Normal path - just upload directly
    let sync_url = get_webdav_sync_url(&url);
    do_webdav_upload(&client, &sync_url, &auth, &json_content)
}

#[tauri::command]
fn sync_from_webdav(url: String, username: String, password: String) -> Result<String, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let auth = build_webdav_auth(&username, &password);

    // Check if we're using Jianguoyun root path - need to look in service-master subfolder
    let normalized_url = url.trim_end_matches('/');
    let is_jianguoyun_root = normalized_url.ends_with("/dav") || normalized_url == "https://dav.jianguoyun.com/dav";

    let sync_url = if is_jianguoyun_root {
        // Try the service-master subfolder first
        format!("{}/service-master/service-master-sync.json", normalized_url)
    } else {
        get_webdav_sync_url(&url)
    };

    eprintln!("Downloading from WebDAV URL: {}", sync_url);

    // Download from WebDAV using GET
    let response = client
        .get(&sync_url)
        .header("Authorization", &auth)
        .send()
        .map_err(|e| format!("Download failed: {}", e))?;

    let status = response.status();
    let status_code = status.as_u16();

    // If 404 on service-master path, try root path as fallback
    if status_code == 404 && is_jianguoyun_root {
        eprintln!("File not found in service-master folder, trying root path...");
        let fallback_url = get_webdav_sync_url(&url);
        let fallback_response = client
            .get(&fallback_url)
            .header("Authorization", &auth)
            .send()
            .map_err(|e| format!("Download failed: {}", e))?;

        let fallback_status = fallback_response.status().as_u16();
        if fallback_status == 404 {
            return Err("未找到同步数据。请先上传配置到 WebDAV。".to_string());
        }
        if fallback_status == 401 {
            return Err("认证失败，请检查用户名和密码".to_string());
        }
        if !fallback_response.status().is_success() {
            return Err(format!("下载失败 ({})", fallback_status));
        }

        let content = fallback_response.text()
            .map_err(|e| format!("Failed to read response: {}", e))?;

        return apply_sync_data(&content);
    }

    if status_code == 404 {
        return Err("未找到同步数据。请先上传配置到 WebDAV。".to_string());
    }
    if status_code == 401 {
        return Err("认证失败，请检查用户名和密码".to_string());
    }
    if !status.is_success() {
        return Err(format!("下载失败 ({})", status_code));
    }

    let content = response.text()
        .map_err(|e| format!("Failed to read response: {}", e))?;

    apply_sync_data(&content)
}

/// Apply downloaded sync data to local storage
fn apply_sync_data(content: &str) -> Result<String, String> {
    let sync_data: WebDavSyncData = serde_json::from_str(content)
        .map_err(|e| format!("无法解析同步数据: {}", e))?;

    // Apply metadata
    save_all_metadata(&sync_data.metadata)?;

    // Apply settings (but keep local WebDAV credentials)
    let current_settings = get_app_settings().unwrap_or_default();
    let mut new_settings = sync_data.settings;
    // Preserve local WebDAV credentials
    new_settings.webdav_url = current_settings.webdav_url;
    new_settings.webdav_username = current_settings.webdav_username;
    new_settings.webdav_password = current_settings.webdav_password;

    let settings_path = get_settings_file_path();
    if let Some(parent) = settings_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let settings_json = serde_json::to_string_pretty(&new_settings)
        .map_err(|e| e.to_string())?;
    fs::write(&settings_path, settings_json).map_err(|e| e.to_string())?;

    Ok(format!("同步成功！(同步时间: {})", sync_data.sync_time))
}

/// Get current time as ISO string (simple implementation without chrono crate)
fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = duration.as_secs();
    // Simple ISO-like format
    format!("{}", secs)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())  // Tauri v2 方式: 注册 updater 插件
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            use tauri::Manager;
            use tauri::menu::{Menu, MenuItem};
            use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_services,
            load_service,
            unload_service,
            restart_service,
            get_service_logs,
            clear_service_logs,
            get_process_by_port,
            kill_process,
            check_port,
            check_health,
            open_url,
            check_app_running,
            quit_app,
            save_service_metadata,
            get_service_metadata,
            get_all_metadata_map,
            import_metadata,
            update_services_order,
            get_app_settings,
            save_app_settings,
            create_service,
            update_service,
            delete_service,
            get_app_version,
            get_platform,
            test_webdav_connection,
            sync_to_webdav,
            sync_from_webdav,
            get_presets
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

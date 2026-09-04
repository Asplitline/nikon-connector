use serde::Serialize;
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use tauri::Manager;

const LOG_FILE_NAME: &str = "nikon-connector.log";
const EXPORT_FILE_NAME: &str = "nikon-connector-diagnostic-log.txt";
const MAX_LOG_BYTES: u64 = 5 * 1024 * 1024;

#[derive(Clone, Copy, Debug)]
pub enum LogLevel {
    Info,
    Warn,
    Error,
}

impl LogLevel {
    fn as_str(self) -> &'static str {
        match self {
            Self::Info => "INFO",
            Self::Warn => "WARN",
            Self::Error => "ERROR",
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogInfo {
    pub log_path: String,
    pub export_path: String,
    pub size_bytes: u64,
}

pub fn log_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_log_dir()
        .map_err(|error| format!("Could not resolve the app log directory: {error}"))
}

pub fn collect_log_info(log_dir: &Path) -> Result<LogInfo, String> {
    fs::create_dir_all(log_dir)
        .map_err(|error| format!("Could not create the app log directory: {error}"))?;
    let log_path = log_dir.join(LOG_FILE_NAME);
    let export_path = log_dir.join(EXPORT_FILE_NAME);
    let size_bytes = fs::metadata(&log_path).map(|meta| meta.len()).unwrap_or(0);

    Ok(LogInfo {
        log_path: log_path.to_string_lossy().to_string(),
        export_path: export_path.to_string_lossy().to_string(),
        size_bytes,
    })
}

pub fn append_log_line(
    log_dir: &Path,
    level: LogLevel,
    target: &str,
    message: &str,
) -> Result<(), String> {
    fs::create_dir_all(log_dir)
        .map_err(|error| format!("Could not create the app log directory: {error}"))?;
    rotate_log_if_needed(log_dir)?;

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_dir.join(LOG_FILE_NAME))
        .map_err(|error| format!("Could not open the app log: {error}"))?;
    let line = format!(
        "{} [{}] {} {}\n",
        timestamp_seconds(),
        level.as_str(),
        sanitize_target(target),
        sanitize_log_message(message)
    );

    file.write_all(line.as_bytes())
        .map_err(|error| format!("Could not write the app log: {error}"))
}

pub fn export_log_bundle(log_dir: &Path) -> Result<PathBuf, String> {
    fs::create_dir_all(log_dir)
        .map_err(|error| format!("Could not create the app log directory: {error}"))?;
    let log_path = log_dir.join(LOG_FILE_NAME);
    let export_path = log_dir.join(EXPORT_FILE_NAME);
    let log_contents = fs::read_to_string(&log_path).unwrap_or_default();
    let info = collect_log_info(log_dir)?;
    let bundle = format!(
        "Nikon Connector Diagnostic Log\nGenerated: {}\nLog path: {}\nSize: {} bytes\n\n{}",
        timestamp_seconds(),
        sanitize_log_message(&info.log_path),
        info.size_bytes,
        sanitize_log_message(&log_contents)
    );

    fs::write(&export_path, bundle)
        .map_err(|error| format!("Could not export the diagnostic log: {error}"))?;
    Ok(export_path)
}

pub fn sanitize_log_message(message: &str) -> String {
    let without_home = redact_home_paths(message);
    redact_query_value(&without_home, "token")
}

pub fn write_client_log(
    app: &tauri::AppHandle,
    level: LogLevel,
    target: &str,
    message: &str,
) -> Result<(), String> {
    append_log_line(&log_dir(app)?, level, target, message)
}

fn rotate_log_if_needed(log_dir: &Path) -> Result<(), String> {
    let log_path = log_dir.join(LOG_FILE_NAME);
    let backup_path = log_dir.join(format!("{LOG_FILE_NAME}.1"));
    let size = fs::metadata(&log_path).map(|meta| meta.len()).unwrap_or(0);

    if size < MAX_LOG_BYTES {
        return Ok(());
    }

    let _ = fs::remove_file(&backup_path);
    fs::rename(&log_path, backup_path)
        .map_err(|error| format!("Could not rotate the app log: {error}"))
}

fn sanitize_target(target: &str) -> String {
    target
        .chars()
        .filter(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '_' | '-' | '.')
        })
        .take(48)
        .collect()
}

fn redact_home_paths(message: &str) -> String {
    let mut redacted = String::with_capacity(message.len());
    let mut rest = message;

    while let Some(start) = rest.find("/Users/") {
        redacted.push_str(&rest[..start]);
        let after_prefix = &rest[start + "/Users/".len()..];
        let Some((_, after_name)) = after_prefix.split_once('/') else {
            redacted.push_str("[user]");
            rest = "";
            break;
        };
        redacted.push_str("[user]/");
        rest = after_name;
    }

    redacted.push_str(rest);
    redacted
}

fn redact_query_value(message: &str, key: &str) -> String {
    let needle = format!("{key}=");
    let mut redacted = String::with_capacity(message.len());
    let mut rest = message;

    while let Some(start) = rest.find(&needle) {
        redacted.push_str(&rest[..start + needle.len()]);
        redacted.push_str("[redacted]");
        let value = &rest[start + needle.len()..];
        if let Some(end) = value.find('&') {
            rest = &value[end..];
        } else {
            rest = "";
            break;
        }
    }

    redacted.push_str(rest);
    redacted
}

fn timestamp_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

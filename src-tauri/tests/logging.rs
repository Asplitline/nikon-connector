use std::fs;

use nikon_connector_lib::logging::{
    append_log_line, collect_log_info, export_log_bundle, sanitize_log_message, LogLevel,
};

#[test]
fn export_log_bundle_contains_recent_logs_and_metadata() {
    let temp_dir =
        std::env::temp_dir().join(format!("nikon-connector-log-test-{}", std::process::id()));
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(&temp_dir).expect("create temp log dir");

    append_log_line(&temp_dir, LogLevel::Info, "frontend", "camera scan started")
        .expect("append frontend log");
    append_log_line(
        &temp_dir,
        LogLevel::Error,
        "backend",
        "failed to read /Users/alice/Pictures/session/card.nef",
    )
    .expect("append backend log");

    let bundle_path = export_log_bundle(&temp_dir).expect("export log bundle");
    let bundle = fs::read_to_string(&bundle_path).expect("read exported log bundle");

    assert!(bundle.contains("Nikon Connector Diagnostic Log"));
    assert!(bundle.contains("camera scan started"));
    assert!(bundle.contains("[user]/Pictures/session/card.nef"));
    assert!(!bundle.contains("/Users/alice"));
}

#[test]
fn collect_log_info_reports_paths_and_size() {
    let temp_dir = std::env::temp_dir().join(format!(
        "nikon-connector-log-info-test-{}",
        std::process::id()
    ));
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(&temp_dir).expect("create temp log dir");

    append_log_line(&temp_dir, LogLevel::Warn, "helper", "permission is pending")
        .expect("append log");

    let info = collect_log_info(&temp_dir).expect("collect log info");

    assert!(info.log_path.ends_with("nikon-connector.log"));
    assert!(info
        .export_path
        .ends_with("nikon-connector-diagnostic-log.txt"));
    assert!(info.size_bytes > 0);
}

#[test]
fn sanitize_log_message_removes_home_paths_and_tokens() {
    let message = sanitize_log_message(
        "copy failed at /Users/alice/Pictures/card.nef?token=secret-token&camera=Z6III",
    );

    assert_eq!(
        message,
        "copy failed at [user]/Pictures/card.nef?token=[redacted]&camera=Z6III"
    );
}

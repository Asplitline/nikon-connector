use std::{
    io::{BufRead, BufReader, Write},
    path::Path,
    process::{Child, ChildStdin, ChildStdout, Command, Stdio},
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
    thread,
};

use serde::Serialize;
use serde_json::Value;

// 常驻 helper 客户端：整个 app 会话复用一个子进程，把「扫描设备 + 打开会话 +
// 等目录」的固定开销（实测每次 3~8s）从每批一次降到全程一次。
//
// PTP 会话不允许并发，所以所有请求经同一把锁串行化——这既是正确性要求，
// 也与 ImageCaptureCore 内部本来就是单条串行队列的事实一致。
pub struct HelperDaemon {
    inner: Mutex<Option<DaemonProcess>>,
    next_id: AtomicU64,
}

struct DaemonProcess {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HelperRequest<'a> {
    pub id: u64,
    pub cmd: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub camera_id: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache_dir: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub destination_dir: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub photo_id: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub photo_ids: Option<&'a [String]>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview_photo_ids: Option<&'a [String]>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rating: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout: Option<f64>,
}

impl<'a> HelperRequest<'a> {
    pub fn new(id: u64, cmd: &'a str) -> Self {
        Self {
            id,
            cmd,
            camera_id: None,
            cache_dir: None,
            destination_dir: None,
            photo_id: None,
            photo_ids: None,
            preview_photo_ids: None,
            rating: None,
            timeout: None,
        }
    }
}

impl Default for HelperDaemon {
    fn default() -> Self {
        Self::new()
    }
}

impl HelperDaemon {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
            next_id: AtomicU64::new(1),
        }
    }

    // 发一条请求并等它的终态响应。子进程未启动或已崩溃时自动拉起。
    pub fn request<T>(&self, helper: &Path, build: impl Fn(u64) -> String) -> Result<T, String>
    where
        T: serde::de::DeserializeOwned,
    {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let line = build(id);

        let mut guard = self
            .inner
            .lock()
            .map_err(|_| "Camera helper lock is poisoned.".to_string())?;

        // 第一次尝试；管道断了（helper 崩溃/被杀）就重启一次再试
        match Self::exchange(&mut guard, helper, &line, id) {
            Ok(payload) => parse_payload(payload),
            Err(first_error) => {
                eprintln!("[nikon-connector] helper request failed, restarting: {first_error}");
                *guard = None;
                let payload = Self::exchange(&mut guard, helper, &line, id)?;
                parse_payload(payload)
            }
        }
    }

    pub fn shutdown(&self) {
        let Ok(mut guard) = self.inner.lock() else {
            return;
        };

        if let Some(mut process) = guard.take() {
            let _ = writeln!(process.stdin, "{{\"id\":0,\"cmd\":\"shutdown\"}}");
            let _ = process.stdin.flush();
            let _ = process.child.wait();
        }
    }

    fn exchange(
        guard: &mut Option<DaemonProcess>,
        helper: &Path,
        line: &str,
        id: u64,
    ) -> Result<Value, String> {
        if guard.is_none() {
            *guard = Some(spawn_daemon(helper)?);
        }

        let process = guard
            .as_mut()
            .ok_or_else(|| "Camera helper is unavailable.".to_string())?;

        writeln!(process.stdin, "{line}")
            .and_then(|_| process.stdin.flush())
            .map_err(|error| format!("Failed to write to camera helper: {error}"))?;

        read_response(&mut process.stdout, id)
    }
}

// 起子进程并把 stderr 单独抽干：helper 的日志很啰嗦，不读会填满管道
// （~64KB）并让 helper 写日志时永久阻塞。
fn spawn_daemon(helper: &Path) -> Result<DaemonProcess, String> {
    let mut child = Command::new(helper)
        .arg("--daemon")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Failed to start nikon-camera-helper: {error}"))?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Camera helper stdin is unavailable.".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Camera helper stdout is unavailable.".to_string())?;

    if let Some(stderr) = child.stderr.take() {
        thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                eprintln!("[nikon-camera-helper] {line}");
            }
        });
    }

    eprintln!("[nikon-connector] camera helper daemon started");

    Ok(DaemonProcess {
        child,
        stdin,
        stdout: BufReader::new(stdout),
    })
}

// 读到匹配 id 的终态响应为止；progress 消息（L3 用）先跳过。
fn read_response(stdout: &mut impl BufRead, id: u64) -> Result<Value, String> {
    let mut line = String::new();

    loop {
        line.clear();
        let read = stdout
            .read_line(&mut line)
            .map_err(|error| format!("Failed to read from camera helper: {error}"))?;

        if read == 0 {
            return Err("Camera helper closed its output.".to_string());
        }

        match classify_response(line.trim(), id) {
            ResponseMatch::Skip => continue,
            ResponseMatch::Result(payload) => return Ok(payload),
            ResponseMatch::Error(message) => return Err(message),
        }
    }
}

pub enum ResponseMatch {
    Error(String),
    Result(Value),
    Skip,
}

// 纯函数，便于单测：判断一行响应是不是本次请求的终态
pub fn classify_response(line: &str, id: u64) -> ResponseMatch {
    if line.is_empty() {
        return ResponseMatch::Skip;
    }

    let Ok(value) = serde_json::from_str::<Value>(line) else {
        // 不是 JSON 就当日志噪音跳过，不因此让整条请求失败
        return ResponseMatch::Skip;
    };

    if value.get("id").and_then(Value::as_u64) != Some(id) {
        return ResponseMatch::Skip;
    }

    match value.get("type").and_then(Value::as_str) {
        Some("result") => {
            ResponseMatch::Result(value.get("payload").cloned().unwrap_or(Value::Null))
        }
        Some("error") => ResponseMatch::Error(
            value
                .get("payload")
                .and_then(|payload| payload.get("message"))
                .and_then(Value::as_str)
                .unwrap_or("Camera helper reported an error.")
                .to_string(),
        ),
        // progress 是 L3 渐进式投递用的中间消息，不是终态
        _ => ResponseMatch::Skip,
    }
}

fn parse_payload<T>(payload: Value) -> Result<T, String>
where
    T: serde::de::DeserializeOwned,
{
    serde_json::from_value(payload)
        .map_err(|error| format!("Invalid nikon-camera-helper payload: {error}"))
}

#[cfg(test)]
mod tests {
    use super::{classify_response, read_response, ResponseMatch};

    #[test]
    fn matches_the_terminal_result_for_the_requested_id() {
        let line = r#"{"id":7,"type":"result","payload":[1,2]}"#;

        match classify_response(line, 7) {
            ResponseMatch::Result(payload) => assert!(payload.is_array()),
            _ => panic!("expected a result"),
        }
    }

    #[test]
    fn surfaces_helper_errors_with_their_message() {
        let line = r#"{"id":3,"type":"error","payload":{"message":"camera not found"}}"#;

        match classify_response(line, 3) {
            ResponseMatch::Error(message) => assert_eq!(message, "camera not found"),
            _ => panic!("expected an error"),
        }
    }

    #[test]
    fn skips_responses_for_other_requests() {
        let line = r#"{"id":9,"type":"result","payload":[]}"#;

        assert!(matches!(classify_response(line, 4), ResponseMatch::Skip));
    }

    #[test]
    fn skips_progress_messages_so_they_do_not_end_the_wait() {
        let line = r#"{"id":4,"type":"progress","payload":{"done":1}}"#;

        assert!(matches!(classify_response(line, 4), ResponseMatch::Skip));
    }

    #[test]
    fn skips_non_json_log_noise() {
        assert!(matches!(
            classify_response("[nikon-camera-helper] browser starting", 1),
            ResponseMatch::Skip
        ));
        assert!(matches!(classify_response("", 1), ResponseMatch::Skip));
    }

    #[test]
    fn reads_past_noise_and_progress_to_the_matching_result() {
        let stream = concat!(
            "not json at all\n",
            "{\"id\":1,\"type\":\"result\",\"payload\":[]}\n",
            "{\"id\":2,\"type\":\"progress\",\"payload\":{}}\n",
            "{\"id\":2,\"type\":\"result\",\"payload\":{\"copied\":3}}\n",
        );
        let mut cursor = std::io::Cursor::new(stream);

        let payload = read_response(&mut cursor, 2).expect("resolves the matching result");

        assert_eq!(payload.get("copied").and_then(|v| v.as_u64()), Some(3));
    }

    #[test]
    fn reports_a_closed_helper_instead_of_hanging() {
        let mut cursor = std::io::Cursor::new("");

        let error = read_response(&mut cursor, 1).expect_err("EOF is an error");

        assert!(error.contains("closed"), "unexpected message: {error}");
    }
}

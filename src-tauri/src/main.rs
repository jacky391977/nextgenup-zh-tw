// NextGenUp desktop shell: spawns the bundled Python server as a sidecar
// and shows the web UI in a native window.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;
#[cfg(target_os = "macos")]
use tauri::menu::{Menu, Submenu, PredefinedMenuItem};

const SERVER_PORT: u16 = 18790;

struct ServerChild(Mutex<Option<Child>>);

fn server_binary_name() -> &'static str {
    if cfg!(windows) {
        "nextgenup-server.exe"
    } else {
        "nextgenup-server"
    }
}

// PyInstaller one-file binaries run as a bootloader that spawns the real
// server as its own child, so killing only the direct child leaves an
// orphan. Kill the whole tree: the process group on Unix, taskkill /T on
// Windows.
fn kill_server_tree(child: &mut Child) {
    #[cfg(unix)]
    unsafe {
        libc::kill(-(child.id() as i32), libc::SIGTERM);
    }
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill")
            .args(["/PID", &child.id().to_string(), "/T", "/F"])
            .output();
    }
    let _ = child.kill();
    let _ = child.wait();
}

#[cfg(target_os = "macos")]
fn chinese_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Menu<R>> {
    #[cfg(target_os = "macos")]
    let app_menu = Submenu::with_items(app, "NextGenUp", true, &[
        &PredefinedMenuItem::about(app, Some("關於 NextGenUp"), None)?,
        &PredefinedMenuItem::separator(app)?,
        &PredefinedMenuItem::services(app, Some("服務"))?,
        &PredefinedMenuItem::separator(app)?,
        &PredefinedMenuItem::hide(app, Some("隱藏 NextGenUp"))?,
        &PredefinedMenuItem::hide_others(app, Some("隱藏其他程式"))?,
        &PredefinedMenuItem::show_all(app, Some("顯示全部"))?,
        &PredefinedMenuItem::separator(app)?,
        &PredefinedMenuItem::quit(app, Some("結束 NextGenUp"))?,
    ])?;
    let file = Submenu::with_items(app, "檔案", true, &[
        &PredefinedMenuItem::close_window(app, Some("關閉視窗"))?,
    ])?;
    let edit = Submenu::with_items(app, "編輯", true, &[
        &PredefinedMenuItem::undo(app, Some("復原"))?,
        &PredefinedMenuItem::redo(app, Some("重做"))?,
        &PredefinedMenuItem::separator(app)?,
        &PredefinedMenuItem::cut(app, Some("剪下"))?,
        &PredefinedMenuItem::copy(app, Some("拷貝"))?,
        &PredefinedMenuItem::paste(app, Some("貼上"))?,
        &PredefinedMenuItem::select_all(app, Some("全選"))?,
    ])?;
    let window = Submenu::with_items(app, "視窗", true, &[
        &PredefinedMenuItem::minimize(app, Some("縮小"))?,
        &PredefinedMenuItem::maximize(app, Some("縮放"))?,
        &PredefinedMenuItem::fullscreen(app, Some("切換全螢幕"))?,
    ])?;
    #[cfg(target_os = "macos")]
    { Menu::with_items(app, &[&app_menu, &file, &edit, &window]) }
    #[cfg(not(target_os = "macos"))]
    { Menu::with_items(app, &[&file, &edit, &window]) }
}

fn main() {
    let builder = tauri::Builder::default();
    #[cfg(target_os = "macos")]
    let builder = builder.menu(chinese_menu);
    builder
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let exe_dir = std::env::current_exe()?
                .parent()
                .expect("executable has a parent dir")
                .to_path_buf();
            let server = exe_dir.join(server_binary_name());

            let data_dir = app
                .path()
                .app_data_dir()
                .expect("app data dir available");
            std::fs::create_dir_all(&data_dir).ok();
            std::fs::create_dir_all(data_dir.join("models")).ok();

            if server.exists() {
                let mut cmd = Command::new(&server);
                cmd.env("PORT", SERVER_PORT.to_string())
                    .env("NEXTGENUP_DATA", &data_dir)
                    // The desktop backend must never listen on the network;
                    // LAN serving is a web-mode (run-from-source) feature.
                    .env("NEXTGENUP_HOST", "127.0.0.1")
                    .current_dir(&data_dir);
                #[cfg(unix)]
                {
                    use std::os::unix::process::CommandExt;
                    cmd.process_group(0);
                }
                #[cfg(windows)]
                {
                    use std::os::windows::process::CommandExt;
                    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
                    cmd.creation_flags(CREATE_NO_WINDOW);
                }
                match cmd.spawn() {
                    Ok(child) => {
                        app.manage(ServerChild(Mutex::new(Some(child))));
                    }
                    Err(e) => eprintln!("failed to start server sidecar: {e}"),
                }
            } else {
                // Dev fallback: assume `python app.py` is running separately.
                eprintln!("server sidecar not found at {server:?}; expecting a dev server");
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building NextGenUp")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(state) = app.try_state::<ServerChild>() {
                    if let Some(mut child) = state.0.lock().unwrap().take() {
                        kill_server_tree(&mut child);
                    }
                }
            }
        });
}

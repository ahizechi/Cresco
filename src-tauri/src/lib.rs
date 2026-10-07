mod finance;
mod habits;
mod private_store;
mod process_lock;
mod routines;
use serde_json::Value;
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;
struct Data {
    directory: PathBuf,
    finance: finance::Store,
    habits: habits::Store,
    routines: routines::Store,
    gate: Mutex<bool>,
}
fn gate(state: &Data) -> Result<std::sync::MutexGuard<'_, bool>, String> {
    let guard = state.gate.lock().map_err(|_| "Data is busy.")?;
    if *guard {
        return Err("An update is being installed. Editing is paused.".into());
    }
    Ok(guard)
}
#[tauri::command]
fn finance_load(state: State<Data>) -> Result<Value, String> {
    state.finance.load()
}
#[tauri::command]
fn finance_save(data: Value, state: State<Data>) -> Result<Value, String> {
    let _guard = gate(&state)?;
    state.finance.save(data)
}
#[tauri::command]
fn finance_recover(data: Value, state: State<Data>) -> Result<Value, String> {
    let _guard = gate(&state)?;
    state.finance.recover(data)
}
#[tauri::command]
fn habits_load(state: State<Data>) -> Result<Value, String> {
    state.habits.load()
}
#[tauri::command]
fn habits_save(data: Value, recovery: bool, state: State<Data>) -> Result<Value, String> {
    let _guard = gate(&state)?;
    state.habits.save(data, recovery)
}
#[tauri::command]
fn routines_load(state: State<Data>) -> Result<Value, String> {
    state.routines.load()
}
#[tauri::command]
fn routines_save(data: Value, revision: u64, state: State<Data>) -> Result<u64, String> {
    let _guard = gate(&state)?;
    state.routines.save(data, revision, false)
}
#[tauri::command]
fn routines_restore(data: Value, recovery: bool, state: State<Data>) -> Result<(), String> {
    let _guard = gate(&state)?;
    state.routines.restore(data, recovery)
}
#[derive(serde::Deserialize)]
#[serde(rename_all = "lowercase")]
enum FinanceExport {
    Backup,
    Transactions,
}
async fn export(
    app: tauri::AppHandle,
    content: String,
    name: &'static str,
    extension: &'static str,
) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut dialog = app
            .dialog()
            .file()
            .set_title("Save Cresco export")
            .set_file_name(name)
            .add_filter("Export", &[extension]);
        if let Some(window) = app.get_webview_window("main") {
            dialog = dialog.set_parent(&window)
        }
        let Some(selected) = dialog.blocking_save_file() else {
            return Ok(false);
        };
        let path = selected.into_path().map_err(|_| "Choose a local file.")?;
        fs::write(path, content).map_err(|_| "Export could not be saved.")?;
        Ok(true)
    })
    .await
    .map_err(|_| "Export stopped unexpectedly.".to_string())?
}
#[tauri::command]
async fn finance_export(
    content: String,
    kind: FinanceExport,
    app: tauri::AppHandle,
) -> Result<bool, String> {
    if content.len() > 64 * 1024 * 1024 {
        return Err("Export exceeds 64 MB.".into());
    }
    let (name, ext) = match kind {
        FinanceExport::Backup => {
            let value = serde_json::from_str(&content).map_err(|_| "Invalid backup.")?;
            finance::validate(&value)?;
            ("cresco-finance-backup.json", "json")
        }
        FinanceExport::Transactions => ("cresco-transactions.csv", "csv"),
    };
    export(app, content, name, ext).await
}
#[tauri::command]
async fn habits_export(content: String, app: tauri::AppHandle) -> Result<bool, String> {
    if content.len() > 16 * 1024 * 1024 {
        return Err("Export exceeds 16 MB.".into());
    }
    let value = serde_json::from_str(&content).map_err(|_| "Invalid backup.")?;
    habits::validate(&value)?;
    export(app, content, "cresco-habits-backup.json", "json").await
}
#[tauri::command]
async fn routines_export(app: tauri::AppHandle) -> Result<bool, String> {
    let content = {
        let state = app.state::<Data>();
        serde_json::to_string_pretty(&{let saved=state.routines.load()?;serde_json::json!({"kind":"cresco-routines/1","revision":saved["revision"],"data":saved["data"]})}).map_err(|_|"Export failed.")?
    };
    export(app, content, "cresco-routines-backup.json", "json").await
}
#[tauri::command]
fn prepare_update(state: State<Data>) -> Result<(), String> {
    let mut guard = gate(&state)?;
    state.finance.load()?;
    state.habits.load()?;
    state.routines.load()?;
    let backup = state
        .directory
        .join("update-backups")
        .join(uuid::Uuid::new_v4().to_string());
    fs::create_dir_all(&backup).map_err(|_| "Could not create update recovery folder.")?;
    for name in ["finance.dpapi", "habits.dpapi", "routines.dpapi"] {
        let source = state.directory.join(name);
        if source.exists() {
            fs::copy(source, backup.join(name))
                .map_err(|_| "Could not preserve data before updating.")?;
        }
    }
    *guard = true;
    Ok(())
}
#[tauri::command]
fn cancel_update(state: State<Data>) -> Result<(), String> {
    *state.gate.lock().map_err(|_| "Data is busy.")? = false;
    Ok(())
}
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            finance_load,
            finance_save,
            finance_recover,
            finance_export,
            habits_load,
            habits_save,
            habits_export,
            routines_load,
            routines_save,
            routines_export,
            routines_restore,
            prepare_update,
            cancel_update
        ])
        .setup(|app| {
            let directory = app.path().app_data_dir()?;
            fs::create_dir_all(&directory)?;
            app.manage(Data {
                finance: finance::Store::new(directory.clone()),
                habits: habits::Store::new(directory.clone()),
                routines: routines::Store::new(directory.clone()),
                directory,
                gate: Mutex::new(false),
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Cresco could not start")
}

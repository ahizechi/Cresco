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
    prepare_data_update(&state)
}
fn prepare_data_update(state: &Data) -> Result<(), String> {
    let mut guard = gate(state)?;
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
            let destination = backup.join(name);
            fs::copy(source, &destination)
                .map_err(|_| "Could not preserve data before updating.")?;
            fs::OpenOptions::new()
                .write(true)
                .open(destination)
                .and_then(|file| file.sync_all())
                .map_err(|_| "Could not flush update recovery data to disk.")?;
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

#[cfg(all(test, windows))]
mod update_tests {
    use super::*;
    fn fixture() -> Data {
        let directory =
            std::env::temp_dir().join(format!("cresco-update-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&directory).unwrap();
        Data {
            finance: finance::Store::new(directory.clone()),
            habits: habits::Store::new(directory.clone()),
            routines: routines::Store::new(directory.clone()),
            directory,
            gate: Mutex::new(false),
        }
    }
    #[test]
    fn preparation_preserves_all_stores_and_blocks_writes_until_cancelled() {
        let state = fixture();
        let finance = state.finance.save(state.finance.load().unwrap()).unwrap();
        let habits = state
            .habits
            .save(state.habits.load().unwrap(), false)
            .unwrap();
        state
            .routines
            .save(serde_json::json!({"routines":[]}), 0, false)
            .unwrap();
        prepare_data_update(&state).unwrap();
        assert!(gate(&state).is_err());
        let backup = fs::read_dir(state.directory.join("update-backups"))
            .unwrap()
            .next()
            .unwrap()
            .unwrap()
            .path();
        for name in ["finance.dpapi", "habits.dpapi", "routines.dpapi"] {
            let saved = fs::read(state.directory.join(name)).unwrap();
            assert_eq!(fs::read(backup.join(name)).unwrap(), saved);
            assert!(saved.starts_with(b"CRESCO0001"));
        }
        assert_eq!(
            finance::Store::new(state.directory.clone()).load().unwrap(),
            finance
        );
        assert_eq!(
            habits::Store::new(state.directory.clone()).load().unwrap(),
            habits
        );
        *state.gate.lock().unwrap() = false;
        assert!(gate(&state).is_ok());
        fs::remove_dir_all(state.directory).unwrap();
    }
    #[test]
    fn unreadable_store_stops_update_without_overwriting_or_locking() {
        let state = fixture();
        fs::write(
            state.directory.join("finance.dpapi"),
            b"unreadable synthetic fixture",
        )
        .unwrap();
        assert!(prepare_data_update(&state).is_err());
        assert!(gate(&state).is_ok());
        assert_eq!(
            fs::read(state.directory.join("finance.dpapi")).unwrap(),
            b"unreadable synthetic fixture"
        );
        assert!(!state.directory.join("update-backups").exists());
        fs::remove_dir_all(state.directory).unwrap();
    }
    #[test]
    fn failed_backup_stops_update_and_retains_readable_records() {
        let state = fixture();
        let saved = state.finance.save(state.finance.load().unwrap()).unwrap();
        fs::write(
            state.directory.join("update-backups"),
            b"synthetic blocking file",
        )
        .unwrap();
        assert!(prepare_data_update(&state).is_err());
        assert!(gate(&state).is_ok());
        assert_eq!(state.finance.load().unwrap(), saved);
        fs::remove_dir_all(state.directory).unwrap();
    }
}

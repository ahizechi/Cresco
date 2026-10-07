fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "finance_load",
            "finance_save",
            "finance_recover",
            "finance_export",
            "habits_load",
            "habits_save",
            "habits_export",
            "routines_load",
            "routines_save",
            "routines_export",
            "routines_restore",
            "prepare_update",
            "cancel_update",
        ]),
    ))
    .expect("Build configuration failed");
}

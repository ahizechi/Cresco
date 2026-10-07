use crate::private_store::{read_private, write_private};
use serde_json::{json, Value};
use std::{fs, path::PathBuf, sync::Mutex};
pub struct Store {
    directory: PathBuf,
    lock: Mutex<()>,
}
pub fn validate(v: &Value) -> Result<(), String> {
    let rows = v["routines"]
        .as_array()
        .filter(|r| r.len() <= 200)
        .ok_or("Invalid routines collection.")?;
    let mut ids = std::collections::HashSet::new();
    for r in rows {
        let id = r["id"]
            .as_str()
            .filter(|s| !s.is_empty() && s.len() <= 200)
            .ok_or("Invalid routine ID.")?;
        if !ids.insert(id) {
            return Err("Duplicate routine ID.".into());
        }
        if r["title"]
            .as_str()
            .filter(|s| !s.trim().is_empty() && s.len() <= 500)
            .is_none()
            || !matches!(r["kind"].as_str(), Some("daily" | "continuous"))
            || !matches!(r["status"].as_str(), Some("running" | "paused" | "stopped"))
            || !r["elapsedMs"]
                .as_u64()
                .is_some_and(|n| n <= 9_007_199_254_740_991)
        {
            return Err("Invalid routine fields.".into());
        }
        if r["createdAt"]
            .as_str()
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .is_none()
        {
            return Err("Invalid creation date.".into());
        }
        if !r["startedAt"].is_null()
            && r["startedAt"]
                .as_str()
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                .is_none()
        {
            return Err("Invalid start date.".into());
        }
        if r["status"] == "running" && r["startedAt"].is_null() {
            return Err("Running routine needs a start date.".into());
        }
        if !r["stoppedAt"].is_null()
            && r["stoppedAt"]
                .as_str()
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                .is_none()
        {
            return Err("Invalid stop date.".into());
        }
        let checks = r["checks"]
            .as_array()
            .filter(|c| c.len() <= 730)
            .ok_or("Invalid routine check dates.")?;
        for day in checks {
            let text = day.as_str().ok_or("Invalid check date.")?;
            let parsed = chrono::NaiveDate::parse_from_str(text, "%Y-%m-%d")
                .map_err(|_| "Invalid check date.")?;
            if parsed.format("%Y-%m-%d").to_string() != text
                || !("2000-01-01"..="2099-12-31").contains(&text)
            {
                return Err("Invalid check date.".into());
            }
        }
        if checks
            .iter()
            .collect::<std::collections::HashSet<_>>()
            .len()
            != checks.len()
        {
            return Err("Duplicate routine check date.".into());
        }
        let history = r["history"]
            .as_array()
            .filter(|h| h.len() <= 100)
            .ok_or("Invalid routine history.")?;
        for h in history {
            if !h["elapsedMs"]
                .as_u64()
                .is_some_and(|n| n <= 9_007_199_254_740_991)
                || h["endedAt"]
                    .as_str()
                    .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                    .is_none()
                || (!h["endUnknown"].is_null() && !h["endUnknown"].is_boolean())
            {
                return Err("Invalid history entry.".into());
            }
        }
    }
    if serde_json::to_vec(v)
        .map_err(|_| "Invalid routines.")?
        .len()
        > 2 * 1024 * 1024
    {
        return Err("Routines exceed 2 MB.".into());
    }
    Ok(())
}
impl Store {
    pub fn new(directory: PathBuf) -> Self {
        Self {
            directory,
            lock: Mutex::new(()),
        }
    }
    fn read(&self) -> Result<Value, String> {
        let p = self.directory.join("routines.dpapi");
        let metadata = match fs::metadata(&p) {
            Ok(m) => m,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                return Ok(json!({"revision":0,"data":{"routines":[]}}))
            }
            Err(_) => return Err("Routines cannot be read.".into()),
        };
        if metadata.len() > 2 * 1024 * 1024 + 1024 {
            return Err("Routines exceed 2 MB.".into());
        }
        let v: Value = serde_json::from_slice(&read_private(&p)?)
            .map_err(|_| "Routines are unreadable. Restore a backup.")?;
        if !v["revision"]
            .as_u64()
            .is_some_and(|n| n <= 9_007_199_254_740_991)
        {
            return Err("Invalid routines revision.".into());
        }
        validate(&v["data"])?;
        Ok(v)
    }
    pub fn load(&self) -> Result<Value, String> {
        let _process = crate::process_lock::ProcessLock::acquire(&self.directory, "routines")?;
        let _guard = self.lock.lock().map_err(|_| "Routines are busy.")?;
        self.read()
    }
    pub fn save(&self, data: Value, revision: u64, recovery: bool) -> Result<u64, String> {
        validate(&data)?;
        let _process = crate::process_lock::ProcessLock::acquire(&self.directory, "routines")?;
        let _guard = self.lock.lock().map_err(|_| "Routines are busy.")?;
        let old = self.read();
        let next = if recovery {
            if old.is_ok() {
                return Err("Routines are readable again. Reload before restoring.".into());
            }
            1
        } else {
            let old = old?;
            if old["revision"] != revision {
                return Err("Routines changed in another process. Reload before saving.".into());
            }
            revision
                .checked_add(1)
                .filter(|n| *n <= 9_007_199_254_740_991)
                .ok_or("Revision overflow.")?
        };
        let target = self.directory.join("routines.dpapi");
        if target.exists() {
            let name = if recovery {
                format!("routines-unreadable-{}.dpapi", uuid::Uuid::new_v4())
            } else {
                "routines.previous.dpapi".into()
            };
            fs::copy(&target, self.directory.join(name))
                .map_err(|_| "Could not preserve routines. Nothing changed.")?;
        }
        write_private(
            &target,
            &serde_json::to_vec(&json!({"revision":next,"data":data}))
                .map_err(|_| "Could not serialize routines.")?,
        )?;
        Ok(next)
    }
    pub fn restore(&self, backup: Value, recovery: bool) -> Result<(), String> {
        if backup["kind"] != "cresco-routines/1" || backup["revision"].as_u64().is_none() {
            return Err("Invalid routines backup.".into());
        }
        let revision = if recovery {
            0
        } else {
            self.load()?["revision"]
                .as_u64()
                .ok_or("Invalid revision.")?
        };
        self.save(backup["data"].clone(), revision, recovery)?;
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_invalid_routine() {
        assert!(validate(&json!({"routines":[{"title":"private"}]})).is_err());
    }
    #[test]
    fn rejects_duplicate_dates_and_unsafe_elapsed_values() {
        let row = json!({"id":"synthetic","title":"Synthetic routine","kind":"continuous","createdAt":"2026-10-07T12:00:00Z","status":"paused","startedAt":null,"elapsedMs":1000,"checks":[],"history":[]});
        assert!(validate(&json!({"routines":[row.clone()]})).is_ok());
        assert!(validate(&json!({"routines":[row.clone(),row.clone()]})).is_err());
        let mut invalid = row.clone();
        invalid["checks"] = json!(["2026-10-07", "2026-10-07"]);
        assert!(validate(&json!({"routines":[invalid]})).is_err());
        let mut invalid = row;
        invalid["elapsedMs"] = json!(9_007_199_254_740_992u64);
        assert!(validate(&json!({"routines":[invalid]})).is_err());
    }
    #[test]
    fn preserves_unreadable_and_previous() {
        let dir = std::env::temp_dir().join(format!("cresco-routines-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let store = Store::new(dir.clone());
        assert_eq!(store.save(json!({"routines":[]}), 0, false).unwrap(), 1);
        assert!(store.save(json!({"routines":[]}), 0, false).is_err());
        fs::write(dir.join("routines.dpapi"), b"corrupt").unwrap();
        assert!(store.save(json!({"routines":[]}), 1, false).is_err());
        assert_eq!(store.save(json!({"routines":[]}), 0, true).unwrap(), 1);
        assert!(fs::read_dir(&dir).unwrap().any(|p| p
            .unwrap()
            .file_name()
            .to_string_lossy()
            .starts_with("routines-unreadable-")));
        fs::remove_dir_all(dir).unwrap();
    }
}

use crate::private_store::{read_private, write_private};
use serde_json::{json, Value};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::PathBuf,
    sync::Mutex,
};
const MAX_BYTES: usize = 16 * 1024 * 1024;
pub struct Store {
    directory: PathBuf,
    lock: Mutex<()>,
}
fn empty() -> Value {
    json!({"schema":1,"revision":0,"timezone":"Europe/London","habits":[],"entries":[]})
}
impl Store {
    pub fn new(directory: PathBuf) -> Self {
        Self {
            directory,
            lock: Mutex::new(()),
        }
    }
    fn read(&self) -> Result<Value, String> {
        let path = self.directory.join("habits.dpapi");
        match fs::metadata(&path) {
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(empty()),
            Err(_) => return Err("Habits could not be read. Check folder permissions.".into()),
            Ok(_) => {}
        }
        let bytes = read_private(&path)?;
        if bytes.len() > MAX_BYTES {
            return Err("The Habits file exceeds 16 MB. It has not been changed.".into());
        }
        let value = serde_json::from_slice(&bytes).map_err(|_| {
            "Habits contains unreadable data. Restore a backup; the original is preserved."
        })?;
        validate(&value)?;
        Ok(value)
    }
    pub fn load(&self) -> Result<Value, String> {
        let _guard = self
            .lock
            .lock()
            .map_err(|_| "Habits is busy. Restart Cresco.")?;
        let _process = crate::process_lock::ProcessLock::acquire(&self.directory, "habits")?;
        self.read()
    }
    pub fn save(&self, mut data: Value, recovery: bool) -> Result<Value, String> {
        validate(&data)?;
        let _guard = self
            .lock
            .lock()
            .map_err(|_| "Habits is busy. Restart Cresco.")?;
        let _process = crate::process_lock::ProcessLock::acquire(&self.directory, "habits")?;
        let old = self.read();
        let revision = if recovery {
            if old.is_ok() {
                return Err("Habits can be read again. Reload before restoring.".into());
            }
            1
        } else {
            let current = old?;
            if data["revision"] != current["revision"] {
                return Err(
                    "Habits changed in another window. Reload Habits before saving again.".into(),
                );
            }
            current["revision"].as_u64().unwrap_or(0) + 1
        };
        data["revision"] = json!(revision);
        let bytes =
            serde_json::to_vec(&data).map_err(|_| "Habits could not be prepared for saving.")?;
        if bytes.len() > MAX_BYTES {
            return Err("Habits exceeds the 16 MB storage limit. Nothing was changed.".into());
        }
        fs::create_dir_all(&self.directory)
            .map_err(|_| "The Habits folder could not be created.")?;
        let target = self.directory.join("habits.dpapi");
        if target.exists() {
            let backup = if recovery {
                format!("habits-unreadable-{}.dpapi", uuid::Uuid::new_v4())
            } else {
                "habits.previous.dpapi".into()
            };
            fs::copy(&target, self.directory.join(backup))
                .map_err(|_| "The recovery copy could not be saved. Habits has not changed.")?;
        }
        write_private(&target, &bytes)?;
        Ok(data)
    }
}
fn text(v: &Value, max: usize, required: bool) -> bool {
    v.as_str().is_some_and(|s| {
        s.encode_utf16().count() <= max
            && (!required || !s.trim().is_empty())
            && !s
                .chars()
                .any(|c| c < ' ' && c != '\n' && c != '\r' && c != '\t')
    })
}
fn integer(v: &Value, max: u64) -> bool {
    v.as_u64().is_some_and(|n| n <= max)
}
fn choice(v: &Value, values: &[&str]) -> bool {
    v.as_str().is_some_and(|s| values.contains(&s))
}
fn date(v: &Value) -> bool {
    v.as_str().is_some_and(|s| {
        s.len() == 10
            && ("2000-01-01"..="2099-12-31").contains(&s)
            && time::Date::parse(
                s,
                &time::format_description::parse_borrowed::<2>("[year]-[month]-[day]")
                    .expect("constant format"),
            )
            .is_ok()
    })
}
fn invalid() -> String {
    "This is not a supported Habits backup. The existing data has not changed.".into()
}
pub fn validate(v: &Value) -> Result<(), String> {
    if v["schema"] != 1
        || !integer(&v["revision"], 9_007_199_254_740_990)
        || !choice(
            &v["timezone"],
            &[
                "Europe/London",
                "Europe/Paris",
                "Europe/Berlin",
                "Europe/Helsinki",
                "America/New_York",
                "America/Chicago",
                "America/Denver",
                "America/Los_Angeles",
                "America/Toronto",
                "America/Sao_Paulo",
                "Asia/Dubai",
                "Asia/Kolkata",
                "Asia/Singapore",
                "Asia/Hong_Kong",
                "Asia/Tokyo",
                "Australia/Sydney",
                "Australia/Perth",
                "Pacific/Auckland",
                "UTC",
            ],
        )
    {
        return Err(invalid());
    }
    let habits = v["habits"].as_array().ok_or_else(invalid)?;
    let entries = v["entries"].as_array().ok_or_else(invalid)?;
    if habits.len() > 500 || entries.len() > 200_000 {
        return Err(invalid());
    }
    let mut ids = HashMap::new();
    for h in habits {
        let id = h["id"].as_str().ok_or_else(invalid)?;
        if !text(&h["id"], 80, true)
            || !id
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
            || !text(&h["name"], 100, true)
            || !text(&h["description"], 1000, false)
            || !text(&h["category"], 40, false)
            || !choice(
                &h["period"],
                &["Anytime", "Morning", "Afternoon", "Evening"],
            )
            || !choice(&h["color"], &["violet", "blue", "amber", "rose"])
        {
            return Err(invalid());
        }
        let rules = h["rules"].as_array().ok_or_else(invalid)?;
        let pauses = h["pauses"].as_array().ok_or_else(invalid)?;
        if rules.is_empty() || rules.len() > 36600 || pauses.len() > 36600 {
            return Err(invalid());
        }
        let mut previous = "";
        for r in rules {
            let from = r["from"].as_str().ok_or_else(invalid)?;
            let days = r["days"].as_array().ok_or_else(invalid)?;
            let mut unique = HashSet::new();
            if !date(&r["from"])
                || from <= previous
                || days.is_empty()
                || days
                    .iter()
                    .any(|d| !integer(d, 6) || !unique.insert(d.as_u64().unwrap_or(99)))
                || !choice(&r["kind"], &["check", "count"])
                || !integer(&r["target"], 1_000_000)
                || r["target"] == 0
                || !text(&r["unit"], 30, false)
                || !r["enabled"].is_boolean()
                || (r["kind"] == "check" && r["target"] != 1)
            {
                return Err(invalid());
            }
            previous = from;
        }
        for p in pauses {
            if !date(&p["from"]) || !date(&p["to"]) || p["from"].as_str() > p["to"].as_str() {
                return Err(invalid());
            }
        }
        if ids
            .insert(id, rules[0]["from"].as_str().ok_or_else(invalid)?)
            .is_some()
        {
            return Err(invalid());
        }
    }
    let mut keys = HashSet::new();
    for e in entries {
        let id = e["habitId"].as_str().ok_or_else(invalid)?;
        let start = ids.get(id).ok_or_else(invalid)?;
        let d = e["date"].as_str().ok_or_else(invalid)?;
        if !date(&e["date"])
            || d < *start
            || !integer(&e["value"], 1_000_000)
            || !e["skipped"].is_boolean()
            || !text(&e["note"], 1000, false)
            || (e["skipped"] == true && e["value"] != 0)
            || !keys.insert((id, d))
        {
            return Err(invalid());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn browser_and_native_habit_backups_share_valid_cases() {
        let fixture: Value =
            serde_json::from_str(include_str!("../../tests/fixtures/contracts/habits.json"))
                .unwrap();
        for value in fixture["valid"].as_array().unwrap() {
            validate(value).unwrap();
        }
        for value in fixture["invalid"].as_array().unwrap() {
            assert!(validate(value).is_err());
        }
    }
    fn sample() -> Value {
        json!({"schema":1,"revision":0,"timezone":"Europe/London","habits":[{"id":"read","name":"Read 📚","description":"Private reason","category":"Learning","period":"Evening","color":"violet","rules":[{"from":"2026-09-01","days":[0,1,2,3,4,5,6],"kind":"count","target":10,"unit":"pages","enabled":true}],"pauses":[]}],"entries":[{"habitId":"read","date":"2026-09-15","value":12,"skipped":false,"note":"Private note"}]})
    }
    #[test]
    fn contracts_reject_invalid_dates_duplicate_days_orphans_and_future_schemas() {
        validate(&sample()).unwrap();
        for (pointer, value) in [
            ("/schema", json!(2)),
            ("/timezone", json!("invalid")),
            ("/habits/0/rules/0/days", json!([1, 1])),
            ("/entries/0/date", json!("2026-02-30")),
            ("/entries/0/date", json!("2026-08-30")),
            ("/entries/0/habitId", json!("missing")),
            ("/entries/0/value", json!(-1)),
            ("/entries/0/skipped", json!(true)),
        ] {
            let mut data = sample();
            *data.pointer_mut(pointer).unwrap() = value;
            assert!(validate(&data).is_err(), "{pointer}");
        }
        let mut data = sample();
        let duplicate = data["entries"][0].clone();
        data["entries"].as_array_mut().unwrap().push(duplicate);
        assert!(validate(&data).is_err());
        // Yes/no habits, and older count habits, are saved without a unit.
        let mut data = sample();
        data["habits"][0]["rules"][0] = json!({"from":"2026-09-01","days":[0],"kind":"check","target":1,"unit":"","enabled":true});
        validate(&data).unwrap();
    }
    #[test]
    fn encrypted_restart_stale_revision_backup_and_recovery() {
        let dir = std::env::temp_dir().join(format!("cresco-habits-{}", uuid::Uuid::new_v4()));
        let store = Store::new(dir.clone());
        assert_eq!(store.load().unwrap(), empty());
        let saved = store.save(sample(), false).unwrap();
        assert_eq!(saved["revision"], 1);
        let encrypted = fs::read(dir.join("habits.dpapi")).unwrap();
        assert!(!String::from_utf8_lossy(&encrypted).contains("Private"));
        assert_eq!(Store::new(dir.clone()).load().unwrap(), saved);
        assert!(store.save(sample(), false).is_err());
        assert!(store.save(sample(), true).is_err());
        let updated = store.save(saved.clone(), false).unwrap();
        assert_eq!(updated["revision"], 2);
        assert_eq!(
            serde_json::from_slice::<Value>(
                &read_private(&dir.join("habits.previous.dpapi")).unwrap()
            )
            .unwrap(),
            saved
        );
        fs::write(dir.join("habits.dpapi"), b"damaged").unwrap();
        assert!(store.load().is_err());
        assert!(store.save(updated, false).is_err());
        let restored = store.save(sample(), true).unwrap();
        assert_eq!(restored["revision"], 1);
        let preserved = fs::read_dir(&dir)
            .unwrap()
            .flatten()
            .find(|e| {
                e.file_name()
                    .to_string_lossy()
                    .starts_with("habits-unreadable")
            })
            .unwrap();
        assert_eq!(fs::read(preserved.path()).unwrap(), b"damaged");
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn simultaneous_edits_have_one_winner() {
        let dir = std::env::temp_dir().join(format!("cresco-habits-{}", uuid::Uuid::new_v4()));
        let store = std::sync::Arc::new(Store::new(dir.clone()));
        let a = std::sync::Arc::clone(&store);
        let b = std::sync::Arc::clone(&store);
        let first = std::thread::spawn(move || a.save(sample(), false));
        let second = std::thread::spawn(move || b.save(sample(), false));
        assert_ne!(
            first.join().unwrap().is_ok(),
            second.join().unwrap().is_ok()
        );
        assert_eq!(store.load().unwrap()["revision"], 1);
        fs::remove_dir_all(dir).unwrap();
    }
}

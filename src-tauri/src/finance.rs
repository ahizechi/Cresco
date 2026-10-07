use crate::private_store::{read_private, write_private};
use serde_json::{json, Value};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::PathBuf,
    sync::Mutex,
};

const MAX_BYTES: usize = 64 * 1024 * 1024;
pub struct Store {
    directory: PathBuf,
    lock: Mutex<()>,
}
impl Store {
    pub fn new(directory: PathBuf) -> Self {
        Self {
            directory,
            lock: Mutex::new(()),
        }
    }
    pub fn load(&self) -> Result<Value, String> {
        let _guard = self
            .lock
            .lock()
            .map_err(|_| "Finance is busy. Restart Cresco.")?;
        self.read()
    }
    fn read(&self) -> Result<Value, String> {
        let path = self.directory.join("finance.dpapi");
        if matches!(fs::metadata(&path), Err(ref e) if e.kind() == std::io::ErrorKind::NotFound) {
            return Ok(
                json!({"schema":1,"revision":0,"accounts":[],"transactions":[],"budgets":[],"recurring":[],"assets":[],"goals":[],"rules":[],"imports":[],"snapshots":[]}),
            );
        }
        let bytes = read_private(&path)?;
        let value: Value = serde_json::from_slice(&bytes).map_err(|_| {
            "Finance data could not be decoded. Your file has been preserved; restore a backup."
        })?;
        validate(&value)?;
        Ok(value)
    }
    pub fn save(&self, mut value: Value) -> Result<Value, String> {
        validate(&value)?;
        let _guard = self
            .lock
            .lock()
            .map_err(|_| "Finance is busy. Restart Cresco.")?;
        let old = self.read()?;
        if value["revision"] != old["revision"] {
            return Err(
                "Finance changed in another window. Reload Finance before saving again.".into(),
            );
        }
        value["revision"] = json!(old["revision"].as_u64().unwrap_or(0) + 1);
        let bytes =
            serde_json::to_vec(&value).map_err(|_| "Finance could not be prepared for saving.")?;
        if bytes.len() > MAX_BYTES {
            return Err(
                "Finance exceeds the 64 MB local storage limit. No data was removed or saved."
                    .into(),
            );
        }
        fs::create_dir_all(&self.directory)
            .map_err(|_| "The Finance folder could not be created.")?;
        let target = self.directory.join("finance.dpapi");
        if target.exists() {
            fs::copy(&target, self.directory.join("finance.previous.dpapi"))
                .map_err(|_| "The recovery copy could not be saved. Finance has not changed.")?;
        }
        write_private(&target, &bytes)?;
        Ok(value)
    }
    pub fn recover(&self, mut value: Value) -> Result<Value, String> {
        validate(&value)?;
        let _guard = self
            .lock
            .lock()
            .map_err(|_| "Finance is busy. Restart Cresco.")?;
        if self.read().is_ok() {
            return Err("Finance can be read again. Reload it before restoring a backup.".into());
        }
        value["revision"] = json!(1);
        let bytes = serde_json::to_vec(&value).map_err(|_| "The backup could not be prepared.")?;
        if bytes.len() > MAX_BYTES {
            return Err("The backup exceeds 64 MB.".into());
        }
        let target = self.directory.join("finance.dpapi");
        let preserved = self
            .directory
            .join(format!("finance-unreadable-{}.dpapi", uuid::Uuid::new_v4()));
        fs::copy(&target, preserved).map_err(|_| {
            "The original file could not be preserved. Recovery stopped without changing it."
        })?;
        write_private(&target, &bytes)?;
        Ok(value)
    }
}

fn text(v: &Value, max: usize) -> bool {
    v.as_str().is_some_and(|s| {
        s.len() <= max
            && !s
                .chars()
                .any(|c| c.is_control() && c != '\n' && c != '\r' && c != '\t')
    })
}
fn required(v: &Value) -> bool {
    text(v, 1200) && v.as_str().is_some_and(|s| !s.trim().is_empty())
}
fn amount(v: &Value) -> bool {
    v.as_i64()
        .is_some_and(|n| n.unsigned_abs() <= 100_000_000_000_000)
}
fn positive(v: &Value) -> bool {
    amount(v) && v.as_i64().unwrap_or(0) > 0
}
fn one_of(v: &Value, values: &[&str]) -> bool {
    v.as_str().is_some_and(|s| values.contains(&s))
}
fn currency(v: &Value) -> bool {
    one_of(
        v,
        &[
            "GBP", "EUR", "USD", "CHF", "CAD", "AUD", "PLN", "JPY", "INR", "SGD", "AED",
        ],
    )
}
fn date(v: &Value) -> bool {
    v.as_str().is_some_and(|s| {
        s.len() == 10
            && ("1900-01-01"..="2200-12-31").contains(&s)
            && time::Date::parse(
                s,
                &time::format_description::parse_borrowed::<2>("[year]-[month]-[day]")
                    .expect("constant format"),
            )
            .is_ok()
    })
}
fn optional_date(v: &Value) -> bool {
    v == "" || date(v)
}
fn invalid() -> String {
    "The Finance file contains invalid data. No changes were saved.".into()
}
pub fn validate(v: &Value) -> Result<(), String> {
    if v["schema"] != 1 {
        return Err(
            "This Finance file uses an unsupported version. Update Cresco before opening it."
                .into(),
        );
    }
    if !v["revision"]
        .as_u64()
        .is_some_and(|n| n < 9_007_199_254_740_990)
    {
        return Err(invalid());
    }
    let names = [
        "accounts",
        "transactions",
        "budgets",
        "recurring",
        "assets",
        "goals",
        "rules",
        "imports",
        "snapshots",
    ];
    for name in names {
        let rows = v[name].as_array().ok_or_else(invalid)?;
        if rows.len() > 200000 {
            return Err(
                "A Finance collection exceeds 200,000 entries. Nothing was truncated or saved."
                    .into(),
            );
        }
        let mut ids = HashSet::new();
        for row in rows {
            if !required(&row["id"])
                || !text(&row["id"], 100)
                || !ids.insert(row["id"].as_str().unwrap_or_default())
            {
                return Err(invalid());
            }
        }
    }
    let accounts = v["accounts"].as_array().unwrap();
    let accounts_by_id: HashMap<&str, &Value> = accounts
        .iter()
        .filter_map(|account| account["id"].as_str().map(|id| (id, account)))
        .collect();
    let account = |id: &Value| id.as_str().and_then(|key| accounts_by_id.get(key).copied());
    for a in accounts {
        if !required(&a["name"])
            || !text(&a["bank"], 1200)
            || !currency(&a["currency"])
            || !one_of(&a["kind"], &["current", "savings", "credit", "cash"])
            || !amount(&a["openingBalance"])
            || !date(&a["openingDate"])
            || !a["archived"].is_boolean()
        {
            return Err(invalid());
        }
    }
    let mut schedules = HashSet::new();
    let mut transfers: HashMap<&str, Vec<&Value>> = HashMap::new();
    for t in v["transactions"].as_array().unwrap() {
        if account(&t["accountId"]).is_none()
            || !date(&t["date"])
            || !required(&t["description"])
            || !text(&t["category"], 1200)
            || !text(&t["note"], 8000)
            || !amount(&t["amount"])
            || !one_of(&t["kind"], &["expense", "income", "transfer", "adjustment"])
            || !one_of(&t["status"], &["posted", "pending"])
            || !one_of(&t["source"], &["manual", "csv", "bank"])
            || t.get("categorySource")
                .is_some_and(|v| !one_of(v, &["suggested", "manual", "known", "rule"]))
            || t.get("suggestedReview")
                .is_some_and(|v| !one_of(v, &["unsure"]))
        {
            return Err(invalid());
        }
        for key in [
            "importKey",
            "batchId",
            "transferId",
            "scheduleKey",
            "providerId",
        ] {
            if t.get(key).is_some_and(|x| !text(x, 4000)) {
                return Err(invalid());
            }
        }
        if let Some(key) = t["scheduleKey"].as_str() {
            if !schedules.insert(key) {
                return Err(invalid());
            }
        }
        if let Some(key) = t["transferId"].as_str() {
            transfers.entry(key).or_default().push(t);
        }
    }
    for group in transfers.values() {
        if group.len() != 2 {
            return Err(invalid());
        }
        let (a, b) = (group[0], group[1]);
        let (x, y) = (a["amount"].as_i64().unwrap(), b["amount"].as_i64().unwrap());
        if a["kind"] != "transfer"
            || b["kind"] != "transfer"
            || a["accountId"] == b["accountId"]
            || a["date"] != b["date"]
            || a["status"] != b["status"]
            || x.signum() == y.signum()
            || x == 0
            || y == 0
            || (account(&a["accountId"]).unwrap()["currency"]
                == account(&b["accountId"]).unwrap()["currency"]
                && x + y != 0)
        {
            return Err(invalid());
        }
    }
    let mut budgets = HashSet::new();
    for b in v["budgets"].as_array().unwrap() {
        let month = format!("{}-01", b["month"].as_str().unwrap_or_default());
        let key = format!("{}:{}:{}", b["month"], b["currency"], b["category"]);
        if !date(&json!(month))
            || !required(&b["category"])
            || !currency(&b["currency"])
            || !positive(&b["limit"])
            || !budgets.insert(key)
        {
            return Err(invalid());
        }
    }
    for r in v["recurring"].as_array().unwrap() {
        if !required(&r["name"])
            || account(&r["accountId"]).is_none()
            || !positive(&r["amount"])
            || !text(&r["category"], 1200)
            || !one_of(&r["kind"], &["expense", "income"])
            || !one_of(&r["frequency"], &["weekly", "monthly", "yearly"])
            || !date(&r["start"])
            || !optional_date(&r["end"])
            || (r["end"] != "" && r["end"].as_str() < r["start"].as_str())
            || !r["paused"].is_boolean()
        {
            return Err(invalid());
        }
    }
    for a in v["assets"].as_array().unwrap() {
        if !required(&a["name"])
            || !currency(&a["currency"])
            || !one_of(&a["kind"], &["asset", "liability"])
            || !amount(&a["value"])
            || a["value"].as_i64().unwrap_or(-1) < 0
            || !date(&a["date"])
            || !text(&a["note"], 8000)
        {
            return Err(invalid());
        }
    }
    for g in v["goals"].as_array().unwrap() {
        if !required(&g["name"])
            || !currency(&g["currency"])
            || !positive(&g["target"])
            || !amount(&g["saved"])
            || g["saved"].as_i64().unwrap_or(-1) < 0
            || !optional_date(&g["deadline"])
            || (g["accountId"] != ""
                && !account(&g["accountId"]).is_some_and(|a| a["currency"] == g["currency"]))
        {
            return Err(invalid());
        }
    }
    for r in v["rules"].as_array().unwrap() {
        if !required(&r["contains"])
            || !required(&r["category"])
            || !one_of(&r["kind"], &["expense", "income"])
            || r.get("match").is_some_and(|value| value != "exact")
        {
            return Err(invalid());
        }
    }
    for i in v["imports"].as_array().unwrap() {
        if account(&i["accountId"]).is_none()
            || !text(&i["name"], 1200)
            || !text(&i["importedAt"], 1200)
            || i["count"].as_u64().is_none()
            || i["duplicateCount"].as_u64().is_none()
        {
            return Err(invalid());
        }
        if let Some(corrections) = i.get("corrections") {
            let rows = corrections.as_array().ok_or_else(invalid)?;
            if rows.len() > 200000
                || rows.iter().any(|row| {
                    !required(&row["transactionId"])
                        || !text(&row["transactionId"], 100)
                        || !amount(&row["beforeAmount"])
                        || !amount(&row["afterAmount"])
                        || row.get("beforeKind").is_some_and(|value| {
                            !one_of(value, &["expense", "income", "transfer", "adjustment"])
                        })
                        || row.get("afterKind").is_some_and(|value| {
                            !one_of(value, &["expense", "income", "transfer", "adjustment"])
                        })
                })
            {
                return Err(invalid());
            }
        }
    }
    for s in v["snapshots"].as_array().unwrap() {
        if !date(&s["date"]) || !currency(&s["currency"]) || !amount(&s["value"]) {
            return Err(invalid());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> Value {
        json!({"schema":1,"revision":0,"accounts":[{"id":"a","name":"Current","bank":"Lloyds","currency":"GBP","kind":"current","openingBalance":15000,"openingDate":"2026-09-01","archived":false}],"transactions":[],"budgets":[],"recurring":[],"assets":[],"goals":[],"rules":[],"imports":[],"snapshots":[]})
    }
    #[test]
    fn rejects_invalid_backup_without_mutation() {
        let mut v = fixture();
        validate(&v).unwrap();
        v["accounts"][0]["openingDate"] = json!("2026-02-31");
        assert!(validate(&v).is_err());
        v = fixture();
        v["schema"] = json!(2);
        assert!(validate(&v).is_err());
        v = fixture();
        v["accounts"][0]["openingBalance"] = json!(1.1);
        assert!(validate(&v).is_err());
    }
    #[test]
    fn rejects_dangling_and_partial_transfers() {
        let mut v = fixture();
        v["transactions"] = json!([{"id":"t","accountId":"a","date":"2026-09-01","description":"Transfer","amount":-100,"category":"Transfer","kind":"transfer","status":"posted","note":"","source":"manual","transferId":"pair"}]);
        assert!(validate(&v).is_err());
        v["transactions"][0]
            .as_object_mut()
            .unwrap()
            .remove("transferId");
        v["transactions"][0]["accountId"] = json!("unknown");
        assert!(validate(&v).is_err());
    }
    #[test]
    fn accepts_reviewed_csv_repairs_and_rejects_malformed_history() {
        let mut v = fixture();
        v["rules"] = json!([{"id":"rule","contains":"synthetic shop","category":"Shopping","kind":"expense","match":"exact"}]);
        v["imports"] = json!([{"id":"batch","accountId":"a","name":"synthetic.csv","importedAt":"2026-09-01T12:00:00Z","count":1,"duplicateCount":1,"status":"applied","corrections":[{"transactionId":"prior","beforeAmount":-1000,"afterAmount":-1020,"beforeKind":"expense","afterKind":"expense"}]}]);
        validate(&v).unwrap();
        v["imports"][0]["corrections"][0]["afterKind"] = json!("guess");
        assert!(validate(&v).is_err());
        v["imports"][0]["corrections"][0]["afterKind"] = json!("expense");
        v["imports"][0]["corrections"][0]["afterAmount"] = json!(1.5);
        assert!(validate(&v).is_err());
    }
    #[cfg(windows)]
    #[test]
    fn encrypted_roundtrip_revision_recovery_and_corruption() {
        let dir = std::env::temp_dir().join(format!(
            "cresco-finance-test-{}-{}",
            std::process::id(),
            time::OffsetDateTime::now_utc().unix_timestamp_nanos()
        ));
        let store = Store::new(dir.clone());
        assert_eq!(store.load().unwrap()["revision"], 0);
        let first = store.save(fixture()).unwrap();
        assert_eq!(first["revision"], 1);
        assert_eq!(store.load().unwrap(), first);
        assert!(store.save(fixture()).is_err());
        let bytes = fs::read(dir.join("finance.dpapi")).unwrap();
        assert!(!String::from_utf8_lossy(&bytes).contains("Lloyds"));
        let second = store.save(first.clone()).unwrap();
        assert_eq!(second["revision"], 2);
        assert_eq!(
            serde_json::from_slice::<Value>(
                &read_private(&dir.join("finance.previous.dpapi")).unwrap()
            )
            .unwrap(),
            first
        );
        fs::write(dir.join("finance.dpapi"), b"broken").unwrap();
        assert!(store.load().is_err());
        assert!(store.save(second).is_err());
        assert_eq!(fs::read(dir.join("finance.dpapi")).unwrap(), b"broken");
        let recovered = store.recover(first).unwrap();
        assert_eq!(store.load().unwrap(), recovered);
        assert!(store.recover(fixture()).is_err());
        assert!(fs::read_dir(&dir).unwrap().any(|entry| entry
            .unwrap()
            .file_name()
            .to_string_lossy()
            .starts_with("finance-unreadable-")));
        fs::remove_dir_all(dir).unwrap();
    }
}

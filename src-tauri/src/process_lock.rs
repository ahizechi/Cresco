use std::path::Path;

/// Serialises encrypted-store operations across the window and the headless
/// companion. The name is derived from the data directory, so test fixtures
/// remain isolated from the installed app.
#[cfg(windows)]
pub struct ProcessLock(*mut std::ffi::c_void);

#[cfg(windows)]
impl ProcessLock {
    pub fn acquire(directory: &Path, store: &str) -> Result<Self, String> {
        use std::os::windows::ffi::OsStrExt;
        unsafe extern "system" {
            fn CreateMutexW(
                attributes: *const std::ffi::c_void,
                initial: i32,
                name: *const u16,
            ) -> *mut std::ffi::c_void;
            fn WaitForSingleObject(handle: *mut std::ffi::c_void, milliseconds: u32) -> u32;
            fn CloseHandle(handle: *mut std::ffi::c_void) -> i32;
        }
        let name = object_name(directory, store);
        let wide: Vec<u16> = std::ffi::OsStr::new(&name)
            .encode_wide()
            .chain(Some(0))
            .collect();
        let handle = unsafe { CreateMutexW(std::ptr::null(), 0, wide.as_ptr()) };
        if handle.is_null() {
            return Err("Local data lock could not be created. Nothing was changed.".into());
        }
        let result = unsafe { WaitForSingleObject(handle, 30_000) };
        if result != 0 && result != 0x80 {
            unsafe { CloseHandle(handle) };
            return Err("Local data is busy in another process. Try again.".into());
        }
        Ok(Self(handle))
    }
}

#[cfg(windows)]
impl Drop for ProcessLock {
    fn drop(&mut self) {
        unsafe extern "system" {
            fn ReleaseMutex(handle: *mut std::ffi::c_void) -> i32;
            fn CloseHandle(handle: *mut std::ffi::c_void) -> i32;
        }
        unsafe {
            ReleaseMutex(self.0);
            CloseHandle(self.0);
        }
    }
}

/// A session-local Windows object name tied to one data directory.
#[cfg(windows)]
pub fn object_name(directory: &Path, kind: &str) -> String {
    use sha2::{Digest, Sha256};
    let digest = Sha256::digest(
        directory
            .as_os_str()
            .to_string_lossy()
            .to_lowercase()
            .as_bytes(),
    );
    format!("Local\\Cresco-{}-{}", kind, hex_digest(&digest[..16]))
}

#[cfg(windows)]
fn hex_digest(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push(HEX[(byte >> 4) as usize] as char);
        out.push(HEX[(byte & 15) as usize] as char);
    }
    out
}

#[cfg(not(windows))]
pub struct ProcessLock;

#[cfg(not(windows))]
impl ProcessLock {
    pub fn acquire(_: &Path, _: &str) -> Result<Self, String> {
        Ok(Self)
    }
}

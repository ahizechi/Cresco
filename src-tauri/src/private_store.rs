// Shared Windows-user encrypted files. The existing envelope is preserved for compatibility.
use std::{fs, io::Write, path::Path};
const MAX_BYTES: usize = 64 * 1024 * 1024;
pub fn read_private(path: &Path) -> Result<Vec<u8>, String> {
    let length = fs::metadata(path)
        .map_err(|_| "The encrypted local file could not be read.")?
        .len();
    if length > MAX_BYTES as u64 + 1024 {
        return Err("The local file exceeds the supported size. It has not been changed.".into());
    }
    let bytes = fs::read(path).map_err(|_| "The encrypted local file could not be read.")?;
    if !bytes.starts_with(b"CRESCO0001") {
        return Err("The local file format is unrecognised. It has not been changed.".into());
    }
    protect(&bytes[10..], false)
}
pub fn write_private(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut encoded = b"CRESCO0001".to_vec();
    encoded.extend(protect(bytes, true)?);
    let temp = path.with_extension("pending");
    let mut file = fs::File::create(&temp).map_err(|_| {
        "The encrypted local file could not be saved. Check disk space and folder permissions."
    })?;
    file.write_all(&encoded)
        .and_then(|()| file.sync_all())
        .map_err(|_| "Writing the encrypted local file failed. The previous file is intact.")?;
    drop(file);
    fs::rename(&temp, path).map_err(|_| {
        "The encrypted local file could not be replaced. The previous file is intact.".to_owned()
    })
}
#[cfg(windows)]
fn protect(bytes: &[u8], encrypt: bool) -> Result<Vec<u8>, String> {
    #[repr(C)]
    struct Blob {
        length: u32,
        data: *mut u8,
    }
    #[link(name = "crypt32")]
    unsafe extern "system" {
        fn CryptProtectData(
            input: *const Blob,
            description: *const u16,
            entropy: *const Blob,
            reserved: *mut std::ffi::c_void,
            prompt: *mut std::ffi::c_void,
            flags: u32,
            output: *mut Blob,
        ) -> i32;
        fn CryptUnprotectData(
            input: *const Blob,
            description: *mut *mut u16,
            entropy: *const Blob,
            reserved: *mut std::ffi::c_void,
            prompt: *mut std::ffi::c_void,
            flags: u32,
            output: *mut Blob,
        ) -> i32;
    }
    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn LocalFree(memory: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
    }
    let input = Blob {
        length: u32::try_from(bytes.len()).map_err(|_| "The local file is too large.")?,
        data: bytes.as_ptr() as *mut u8,
    };
    let mut output = Blob {
        length: 0,
        data: std::ptr::null_mut(),
    };
    // DPAPI binds these files to this Windows user; UI is forbidden even on failure.
    let success = unsafe {
        if encrypt {
            CryptProtectData(
                &input,
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                1,
                &mut output,
            )
        } else {
            CryptUnprotectData(
                &input,
                std::ptr::null_mut(),
                std::ptr::null(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                1,
                &mut output,
            )
        }
    };
    if success == 0 {
        return Err("Windows could not unlock or protect this data. Use the Windows account that created it, or restore an exported backup.".into());
    }
    let result =
        unsafe { std::slice::from_raw_parts(output.data, output.length as usize).to_vec() };
    unsafe {
        LocalFree(output.data.cast());
    }
    Ok(result)
}
#[cfg(not(windows))]
fn protect(_: &[u8], _: bool) -> Result<Vec<u8>, String> {
    Err("Encrypted local storage currently requires Windows.".into())
}

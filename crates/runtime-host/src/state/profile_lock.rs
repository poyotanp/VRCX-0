use super::*;

pub(super) struct ProfileLock {
    inner: Mutex<Option<ProfileLockGuard>>,
}

pub(super) struct BackendStartGuard<'a> {
    flag: &'a AtomicBool,
}

impl<'a> BackendStartGuard<'a> {
    pub(super) fn try_acquire(flag: &'a AtomicBool) -> Option<Self> {
        flag.compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .ok()
            .map(|_| Self { flag })
    }
}

impl Drop for BackendStartGuard<'_> {
    fn drop(&mut self) {
        self.flag.store(false, Ordering::Release);
    }
}

pub(super) struct AtomicFlagGuard {
    flag: Arc<AtomicBool>,
}

impl AtomicFlagGuard {
    pub(super) fn try_acquire(flag: &Arc<AtomicBool>) -> Option<Self> {
        flag.compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .ok()
            .map(|_| Self {
                flag: Arc::clone(flag),
            })
    }
}

impl Drop for AtomicFlagGuard {
    fn drop(&mut self) {
        self.flag.store(false, Ordering::Release);
    }
}

struct ProfileLockGuard {
    path: PathBuf,
    _file: File,
}

impl ProfileLock {
    pub(super) fn acquire(app_data: &Path) -> Result<Self> {
        std::fs::create_dir_all(app_data)?;
        let path = app_data.join(PROFILE_LOCK_FILE);
        let mut file = open_profile_lock_file(&path)?;
        let _ = file.set_len(0);
        let _ = writeln!(file, "{}", std::process::id());
        Ok(Self {
            inner: Mutex::new(Some(ProfileLockGuard { path, _file: file })),
        })
    }

    pub(super) fn release(&self) {
        if let Ok(mut guard) = self.inner.lock() {
            guard.take();
        }
    }
}

impl Drop for ProfileLockGuard {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
    }
}

fn open_profile_lock_file(path: &Path) -> Result<File> {
    let file = OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(path)
        .map_err(crate::Error::Io)?;

    match file.try_lock() {
        Ok(()) => Ok(file),
        Err(std::fs::TryLockError::WouldBlock) => Err(crate::Error::Custom(format!(
            "VRCX-0 profile is already in use: {}",
            path.display()
        ))),
        Err(std::fs::TryLockError::Error(error)) => Err(crate::Error::Io(error)),
    }
}

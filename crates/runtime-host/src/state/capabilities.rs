use super::*;

impl RuntimeHostState {
    pub fn set_event_sink<S>(&self, sink: S)
    where
        S: RuntimeEventSink + 'static,
    {
        self.runtime_context
            .event_bus
            .set_sink(RuntimeHostEventSink::new(
                self.backend_runtime.clone(),
                Arc::clone(&self.runtime_context),
                sink,
            ));
    }

    pub fn snapshot_backend_runtime(&self) -> BackendRuntimeSnapshot {
        self.backend_runtime.snapshot()
    }

    pub fn app_launcher_snapshot(&self) -> AppLauncherSnapshot {
        self.auto_launch.snapshot()
    }

    pub fn set_vr_overlay_enabled(&self, enabled: bool) -> Result<VrOverlayRuntimeSnapshot> {
        self.runtime_context
            .config()
            .set_bool(VR_OVERLAY_ENABLED_CONFIG_KEY, enabled)?;
        self.vr_overlay_runtime.set_enabled(enabled);
        Ok(self.vr_overlay_runtime.snapshot())
    }

    pub fn reload_vr_overlay_config(&self) -> VrOverlayRuntimeSnapshot {
        self.vr_overlay_runtime.reconcile_current();
        self.vr_overlay_runtime.snapshot()
    }

    pub fn vr_overlay_snapshot(&self) -> VrOverlayRuntimeSnapshot {
        self.vr_overlay_runtime.snapshot()
    }

    pub fn is_vr_overlay_running(&self) -> bool {
        self.vr_overlay_runtime.is_running()
    }

    pub fn overlay_activity_snapshot(&self) -> OverlayActivitySnapshot {
        self.runtime_context.overlay_activity.snapshot()
    }

    pub fn reload_overlay_activity_filters(&self) {
        self.runtime_context.reload_overlay_activity_filters();
        self.vr_overlay_runtime.reconcile_current();
    }

    pub fn set_app_launcher_enabled(&self, enabled: bool) -> Result<AppLauncherSnapshot> {
        self.runtime_context
            .config()
            .set_bool(APP_LAUNCHER_ENABLED_CONFIG_KEY, enabled)?;
        Ok(self.auto_launch.set_enabled(enabled))
    }

    pub fn set_app_launcher_entries(
        &self,
        entries: Vec<AppLauncherEntry>,
    ) -> Result<AppLauncherSnapshot> {
        let entries = normalize_app_launcher_entries(entries);
        self.runtime_context.config().set_json(
            APP_LAUNCHER_ENTRIES_CONFIG_KEY,
            &serde_json::to_value(&entries)?,
        )?;
        Ok(self.auto_launch.set_entries(entries))
    }

    pub fn test_app_launcher_entry(&self, entry_id: &str) -> Result<AppLauncherSnapshot> {
        self.auto_launch
            .test_entry(entry_id)
            .map_err(crate::Error::Custom)
    }

    pub fn stop_app_launcher_test_run(&self, run_id: &str) -> Result<AppLauncherSnapshot> {
        self.auto_launch
            .stop_test_run(run_id)
            .map_err(crate::Error::Custom)
    }

    pub fn registry_backup_list(&self) -> Result<Vec<RegistryBackupSnapshot>> {
        let _guard = self.acquire_registry_backup_lock()?;
        Ok(vrcx_0_application::registry_backup_list(self.db.as_ref())?)
    }

    pub fn registry_backup_create(&self, name: &str) -> Result<Vec<RegistryBackupSnapshot>> {
        let _guard = self.acquire_registry_backup_lock()?;
        let host = HostRegistryBackupActions;
        Ok(vrcx_0_application::registry_backup_create(
            self.db.as_ref(),
            &host,
            name,
        )?)
    }

    pub fn registry_backup_restore(&self, key: &str) -> Result<RegistryBackupSnapshot> {
        let _guard = self.acquire_registry_backup_lock()?;
        let host = HostRegistryBackupActions;
        Ok(vrcx_0_application::registry_backup_restore(
            self.db.as_ref(),
            &host,
            key,
        )?)
    }

    pub fn registry_backup_delete(&self, key: &str) -> Result<Vec<RegistryBackupSnapshot>> {
        let _guard = self.acquire_registry_backup_lock()?;
        Ok(vrcx_0_application::registry_backup_delete(
            self.db.as_ref(),
            key,
        )?)
    }

    pub fn registry_backup_export_json(&self, key: &str) -> Result<String> {
        let _guard = self.acquire_registry_backup_lock()?;
        Ok(vrcx_0_application::registry_backup_export_json(
            self.db.as_ref(),
            key,
        )?)
    }

    pub fn registry_backup_import_json(&self, json: &str) -> Result<()> {
        let _guard = self.acquire_registry_backup_lock()?;
        let host = HostRegistryBackupActions;
        Ok(vrcx_0_application::registry_backup_import_json(
            self.db.as_ref(),
            &host,
            json,
        )?)
    }

    pub fn registry_backup_maintenance_run(
        &self,
        reason: &str,
        mode: RegistryBackupMaintenanceMode,
    ) -> Result<RegistryBackupMaintenanceResult> {
        let _guard = self.acquire_registry_backup_lock()?;
        let host = HostRegistryBackupActions;
        Ok(vrcx_0_application::registry_backup_maintenance_run(
            self.db.as_ref(),
            &host,
            mode,
            reason,
        )?)
    }

    fn acquire_registry_backup_lock(&self) -> Result<MutexGuard<'_, ()>> {
        self.registry_backup_lock.lock().map_err(|error| {
            crate::Error::Custom(format!("registry backup lock poisoned: {error}"))
        })
    }
}

use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde_json::{json, Value};
use vrcx_0_application::{
    HostSessionRuntime, ImageCache, OverlayActivityDelivery, OverlayActivitySink,
    OverlayActivitySnapshot, RuntimeDiagnostics, RuntimeEventBus, TaskSupervisor, WebClient,
};
use vrcx_0_host::overlay_notifications::{send_xs_notification, OvrToolkit};
use vrcx_0_persistence::config::ConfigRepository;
use vrcx_0_vrchat_client::web_client::WebExecuteRequest;

use crate::vr_overlay::{OverlayLocale, OverlayLocalizer};

const APP_LANGUAGE_CONFIG_KEY: &str = "appLanguage";
const WEBHOOK_TIMEOUT: Duration = Duration::from_secs(10);
const WEBHOOK_RETRY_DELAYS: &[Duration] = &[Duration::from_millis(750), Duration::from_secs(2)];

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NotificationDeliveryPreferences {
    pub desktop_toast: String,
    pub desktop_notification_sound: bool,
    pub notification_tts: String,
    pub xs_notifications: bool,
    pub ovrt_hud_notifications: bool,
    pub ovrt_wrist_notifications: bool,
    pub image_notifications: bool,
    pub notification_timeout_ms: i32,
    pub notification_opacity_percent: i32,
    pub webhook_enabled: bool,
    pub webhook_url: String,
    pub webhook_format: String,
}

impl Default for NotificationDeliveryPreferences {
    fn default() -> Self {
        Self {
            desktop_toast: "Never".into(),
            desktop_notification_sound: false,
            notification_tts: "Never".into(),
            xs_notifications: true,
            ovrt_hud_notifications: true,
            ovrt_wrist_notifications: false,
            image_notifications: true,
            notification_timeout_ms: 3000,
            notification_opacity_percent: 100,
            webhook_enabled: false,
            webhook_url: String::new(),
            webhook_format: "generic".into(),
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct NotificationDeliveryGameState {
    pub is_game_running: bool,
    pub is_steamvr_running: bool,
    pub is_game_no_vr: bool,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct NotificationDeliveryPlan {
    pub desktop: bool,
    pub xs: bool,
    pub ovrt: bool,
    pub ovrt_hud: bool,
    pub ovrt_wrist: bool,
    pub webhook: bool,
    pub tts: bool,
}

impl NotificationDeliveryPlan {
    fn is_empty(self) -> bool {
        !self.desktop && !self.xs && !self.ovrt && !self.webhook && !self.tts
    }

    fn needs_local_image(self) -> bool {
        self.desktop || self.xs || self.ovrt
    }
}

pub fn decide_notification_plan(
    delivery: &OverlayActivityDelivery,
    preferences: &NotificationDeliveryPreferences,
    game: &NotificationDeliveryGameState,
) -> NotificationDeliveryPlan {
    let desktop = delivery.desktop && should_play_for_condition(&preferences.desktop_toast, game);
    let vr = delivery.vr && game.is_steamvr_running;
    let xs = vr && preferences.xs_notifications;
    let ovrt_hud = vr && preferences.ovrt_hud_notifications;
    let ovrt_wrist = vr && preferences.ovrt_wrist_notifications;
    let ovrt = ovrt_hud || ovrt_wrist;
    let webhook = delivery.webhook
        && preferences.webhook_enabled
        && !preferences.webhook_url.trim().is_empty();
    let tts = (delivery.desktop || delivery.vr)
        && should_play_for_condition(&preferences.notification_tts, game);

    NotificationDeliveryPlan {
        desktop,
        xs,
        ovrt,
        ovrt_hud,
        ovrt_wrist,
        webhook,
        tts,
    }
}

pub trait DesktopNotifier: Send + Sync {
    fn show(
        &self,
        title: &str,
        body: Option<&str>,
        image: Option<&str>,
        play_sound: bool,
    ) -> Result<(), String>;
}

#[derive(Clone, Default)]
pub struct DesktopNotifierSlot {
    inner: Arc<Mutex<Option<Arc<dyn DesktopNotifier>>>>,
}

impl DesktopNotifierSlot {
    pub fn set(&self, notifier: Arc<dyn DesktopNotifier>) {
        match self.inner.lock() {
            Ok(mut slot) => {
                *slot = Some(notifier);
            }
            Err(error) => {
                tracing::warn!("failed to set desktop notification bridge: {error}");
            }
        }
    }
}

impl DesktopNotifier for DesktopNotifierSlot {
    fn show(
        &self,
        title: &str,
        body: Option<&str>,
        image: Option<&str>,
        play_sound: bool,
    ) -> Result<(), String> {
        let notifier = self
            .inner
            .lock()
            .map_err(|error| format!("desktop notification bridge lock poisoned: {error}"))?
            .clone();
        let Some(notifier) = notifier else {
            return Ok(());
        };
        notifier.show(title, body, image, play_sound)
    }
}

pub struct NotificationDispatcher {
    session: HostSessionRuntime,
    config: ConfigRepository,
    image_cache: Arc<ImageCache>,
    ovrt: Arc<OvrToolkit>,
    web: Arc<WebClient>,
    desktop: Arc<dyn DesktopNotifier>,
    event_bus: RuntimeEventBus,
    diagnostics: RuntimeDiagnostics,
    tasks: TaskSupervisor,
}

pub struct NotificationDispatcherDeps {
    pub session: HostSessionRuntime,
    pub config: ConfigRepository,
    pub image_cache: Arc<ImageCache>,
    pub web: Arc<WebClient>,
    pub desktop: Arc<dyn DesktopNotifier>,
    pub event_bus: RuntimeEventBus,
    pub diagnostics: RuntimeDiagnostics,
    pub tasks: TaskSupervisor,
}

impl NotificationDispatcher {
    pub fn new(deps: NotificationDispatcherDeps) -> Self {
        Self {
            session: deps.session,
            config: deps.config,
            image_cache: deps.image_cache,
            ovrt: Arc::new(OvrToolkit::new()),
            web: deps.web,
            desktop: deps.desktop,
            event_bus: deps.event_bus,
            diagnostics: deps.diagnostics,
            tasks: deps.tasks,
        }
    }
}

impl OverlayActivitySink for NotificationDispatcher {
    fn emit_overlay_activity_snapshot(&self, _snapshot: OverlayActivitySnapshot) {}

    fn emit_overlay_activity_delivery(&self, delivery: OverlayActivityDelivery) {
        let preferences = load_preferences(&self.config);
        let game = load_game_state(&self.session, &self.config);
        let plan = decide_notification_plan(&delivery, &preferences, &game);
        if plan.is_empty() {
            return;
        }
        let locale = load_locale(&self.config);
        let render = render_delivery(&delivery, locale);
        let image_cache = Arc::clone(&self.image_cache);
        let ovrt = Arc::clone(&self.ovrt);
        let web = Arc::clone(&self.web);
        let desktop = Arc::clone(&self.desktop);
        let event_bus = self.event_bus.clone();
        let diagnostics = self.diagnostics.clone();

        self.tasks.spawn(async move {
            dispatch_rendered_notification(
                delivery,
                preferences,
                plan,
                render,
                image_cache,
                ovrt,
                web,
                desktop,
                event_bus,
                diagnostics,
            )
            .await;
        });
    }
}

#[allow(clippy::too_many_arguments)]
async fn dispatch_rendered_notification(
    delivery: OverlayActivityDelivery,
    preferences: NotificationDeliveryPreferences,
    plan: NotificationDeliveryPlan,
    render: RenderedNotification,
    image_cache: Arc<ImageCache>,
    ovrt: Arc<OvrToolkit>,
    web: Arc<WebClient>,
    desktop: Arc<dyn DesktopNotifier>,
    event_bus: RuntimeEventBus,
    diagnostics: RuntimeDiagnostics,
) {
    if plan.tts {
        event_bus.emit("notificationTts", render.tts_payload(&delivery));
    }

    let local_image = if plan.needs_local_image() && preferences.image_notifications {
        resolve_local_image(image_cache.as_ref(), &render.image_url).await
    } else {
        None
    };
    let local_image_ref = local_image.as_deref();
    let timeout_seconds = (preferences.notification_timeout_ms.max(0) / 1000).max(0);
    let opacity = (preferences.notification_opacity_percent.clamp(0, 100) as f64) / 100.0;

    if plan.desktop {
        if let Err(error) = desktop.show(
            &render.title,
            non_empty(&render.body),
            local_image_ref,
            preferences.desktop_notification_sound,
        ) {
            tracing::warn!("[Desktop] notification send failed: {error}");
        }
    }

    if plan.xs {
        if let Err(error) = send_xs_notification(
            &render.title,
            &render.text,
            timeout_seconds,
            opacity,
            local_image_ref,
        ) {
            tracing::warn!("[XSOverlay] notification send failed: {error}");
        }
    }

    if plan.ovrt {
        ovrt.send_notification(
            plan.ovrt_hud,
            plan.ovrt_wrist,
            &render.title,
            &render.body_or_text(),
            timeout_seconds,
            opacity,
            local_image_ref,
        );
    }

    if plan.webhook {
        send_webhook_with_retry(&web, &diagnostics, &delivery, &render, &preferences).await;
    }
}

#[derive(Clone, Debug)]
struct RenderedNotification {
    title: String,
    body: String,
    text: String,
    image_url: String,
}

impl RenderedNotification {
    fn body_or_text(&self) -> String {
        if self.body.trim().is_empty() {
            self.text.clone()
        } else {
            self.body.clone()
        }
    }

    fn tts_payload(&self, delivery: &OverlayActivityDelivery) -> Value {
        json!({
            "sourceId": &delivery.entry.source_id,
            "activityType": &delivery.entry.activity_type,
            "desktop": delivery.desktop,
            "vr": delivery.vr,
            "title": &self.title,
            "body": &self.body,
            "text": &self.text,
            "imageUrl": &self.image_url,
            "actorUserId": &delivery.entry.actor_user_id,
        })
    }
}

fn render_delivery(
    delivery: &OverlayActivityDelivery,
    locale: OverlayLocale,
) -> RenderedNotification {
    let localizer = OverlayLocalizer::new(locale);
    let entry = &delivery.entry;
    let title = localizer.text(&entry.content.title);
    let body = localizer.text(&entry.content.body);
    let text = combine_text(&title, &body);
    RenderedNotification {
        title,
        body,
        text,
        image_url: entry.content.image_url.clone(),
    }
}

fn combine_text(title: &str, body: &str) -> String {
    let title = title.trim();
    let body = body.trim();
    match (title.is_empty(), body.is_empty()) {
        (false, false) => format!("{title} {body}"),
        (false, true) => title.to_string(),
        (true, false) => body.to_string(),
        (true, true) => String::new(),
    }
}

fn should_play_for_condition(condition: &str, game: &NotificationDeliveryGameState) -> bool {
    match condition {
        "Always" => true,
        "Inside VR" => game.is_steamvr_running,
        "Outside VR" => !game.is_steamvr_running,
        "Game Closed" => !game.is_game_running,
        "Game Running" => game.is_game_running,
        "Desktop Mode" => game.is_game_no_vr && game.is_game_running,
        _ => false,
    }
}

fn load_preferences(config: &ConfigRepository) -> NotificationDeliveryPreferences {
    NotificationDeliveryPreferences {
        desktop_toast: config_string(config, "desktopToast", "Never"),
        desktop_notification_sound: config_bool(config, "desktopNotificationSound", false),
        notification_tts: config_string(config, "notificationTTS", "Never"),
        xs_notifications: config_bool_with_legacy(config, "xsNotifications", true),
        ovrt_hud_notifications: config_bool_with_legacy(config, "ovrtHudNotifications", true),
        ovrt_wrist_notifications: config_bool_with_legacy(config, "ovrtWristNotifications", false),
        image_notifications: config_bool_with_legacy(config, "imageNotifications", true),
        notification_timeout_ms: config_int_with_legacy(config, "notificationTimeout", 3000),
        notification_opacity_percent: config_int_with_legacy(config, "notificationOpacity", 100),
        webhook_enabled: config_bool(config, "webhookEnabled", false),
        webhook_url: config_string(config, "webhookUrl", ""),
        webhook_format: normalize_webhook_format(&config_string(
            config,
            "webhookFormat",
            "generic",
        )),
    }
}

fn load_game_state(
    session: &HostSessionRuntime,
    config: &ConfigRepository,
) -> NotificationDeliveryGameState {
    let snapshot = session.snapshot();
    NotificationDeliveryGameState {
        is_game_running: snapshot.is_game_running,
        is_steamvr_running: snapshot.is_steamvr_running,
        is_game_no_vr: config_bool(config, "isGameNoVR", false),
    }
}

fn load_locale(config: &ConfigRepository) -> OverlayLocale {
    config
        .get_string(APP_LANGUAGE_CONFIG_KEY, "en")
        .map(|value| OverlayLocale::from_config(&value))
        .unwrap_or_default()
}

fn config_string(config: &ConfigRepository, key: &str, default_value: &str) -> String {
    config
        .get_string(key, default_value)
        .unwrap_or_else(|_| default_value.to_string())
}

fn config_bool(config: &ConfigRepository, key: &str, default_value: bool) -> bool {
    config.get_bool(key, default_value).unwrap_or(default_value)
}

fn config_bool_with_legacy(config: &ConfigRepository, key: &str, default_value: bool) -> bool {
    if config.get_raw(key).ok().flatten().is_some() {
        return config_bool(config, key, default_value);
    }
    if let Some(legacy_key) = legacy_overlay_notification_key(key) {
        if config.get_raw(legacy_key).ok().flatten().is_some() {
            return config_bool(config, legacy_key, default_value);
        }
    }
    default_value
}

fn config_int_with_legacy(config: &ConfigRepository, key: &str, default_value: i32) -> i32 {
    if let Some(raw) = config.get_raw(key).ok().flatten() {
        return parse_config_int(&raw, default_value);
    }
    if let Some(legacy_key) = legacy_overlay_notification_key(key) {
        if let Some(raw) = config.get_raw(legacy_key).ok().flatten() {
            return parse_config_int(&raw, default_value);
        }
    }
    default_value
}

fn parse_config_int(value: &str, default_value: i32) -> i32 {
    value.trim().parse::<i32>().unwrap_or(default_value)
}

fn legacy_overlay_notification_key(key: &str) -> Option<&'static str> {
    match key {
        "xsNotifications" => Some("VRCX-0_xsNotifications"),
        "ovrtHudNotifications" => Some("VRCX-0_ovrtHudNotifications"),
        "ovrtWristNotifications" => Some("VRCX-0_ovrtWristNotifications"),
        "imageNotifications" => Some("VRCX-0_imageNotifications"),
        "notificationTimeout" => Some("VRCX-0_notificationTimeout"),
        "notificationOpacity" => Some("VRCX-0_notificationOpacity"),
        _ => None,
    }
}

fn normalize_webhook_format(value: &str) -> String {
    if value == "discord" {
        "discord".into()
    } else {
        "generic".into()
    }
}

async fn resolve_local_image(image_cache: &ImageCache, image_url: &str) -> Option<String> {
    let url = image_url.trim();
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return None;
    }
    let file_id = extract_file_id(url)?;
    let version = extract_file_version(url, &file_id).unwrap_or_else(|| fallback_file_version(url));
    if version.is_empty() {
        return None;
    }
    image_cache.get_image(url, &file_id, &version).await.ok()
}

fn extract_file_id(value: &str) -> Option<String> {
    let start = value.find("file_")?;
    let id = value[start..]
        .chars()
        .take_while(|ch| ch.is_ascii_alphanumeric() || *ch == '-' || *ch == '_')
        .collect::<String>();
    (!id.is_empty()).then_some(id)
}

fn extract_file_version(value: &str, file_id: &str) -> Option<String> {
    let marker = format!("/{file_id}/");
    let start = value.find(&marker)? + marker.len();
    let version = value[start..]
        .chars()
        .take_while(|ch| ch.is_ascii_digit())
        .collect::<String>();
    (!version.is_empty()).then_some(version)
}

fn fallback_file_version(value: &str) -> String {
    value
        .split('/')
        .next_back()
        .unwrap_or_default()
        .split('?')
        .next()
        .unwrap_or_default()
        .to_string()
}

async fn send_webhook_with_retry(
    web: &WebClient,
    diagnostics: &RuntimeDiagnostics,
    delivery: &OverlayActivityDelivery,
    render: &RenderedNotification,
    preferences: &NotificationDeliveryPreferences,
) {
    let url = preferences.webhook_url.trim();
    if url.is_empty() {
        return;
    }
    let payload = webhook_payload(delivery, render, &preferences.webhook_format);
    let body = match serde_json::to_string(&payload) {
        Ok(body) => body,
        Err(error) => {
            diagnostics.record_command("notificationWebhook", "error", error.to_string());
            return;
        }
    };
    let mut last_error = String::new();
    for attempt in 0..=WEBHOOK_RETRY_DELAYS.len() {
        match send_webhook_once(web, url, &body).await {
            Ok(status) if (200..=399).contains(&status) => return,
            Ok(status) => {
                last_error = format!("HTTP {status}");
                if !webhook_status_retryable(status) {
                    break;
                }
            }
            Err(error) => {
                last_error = error;
            }
        }
        if let Some(delay) = WEBHOOK_RETRY_DELAYS.get(attempt) {
            tokio::time::sleep(*delay).await;
        }
    }
    diagnostics.record_command(
        "notificationWebhook",
        "error",
        format!("{}: {last_error}", delivery.entry.activity_type),
    );
    tracing::warn!(
        activity_type = %delivery.entry.activity_type,
        error = %last_error,
        "webhook notification delivery failed"
    );
}

async fn send_webhook_once(web: &WebClient, url: &str, body: &str) -> Result<i32, String> {
    let mut request = WebExecuteRequest::new(url.to_string(), "POST".to_string());
    request
        .headers
        .push(("Content-Type".into(), "application/json".into()));
    request.body = Some(body.to_string());
    match tokio::time::timeout(WEBHOOK_TIMEOUT, web.execute(request)).await {
        Ok(Ok((status, _data))) => Ok(status),
        Ok(Err(error)) => Err(error.to_string()),
        Err(_) => Err("timeout".into()),
    }
}

fn webhook_status_retryable(status: i32) -> bool {
    matches!(status, 408 | 409 | 425 | 429 | 500..=599 | -1)
}

fn webhook_payload(
    delivery: &OverlayActivityDelivery,
    render: &RenderedNotification,
    format: &str,
) -> Value {
    if format == "discord" {
        return discord_webhook_payload(delivery, render);
    }
    let entry = &delivery.entry;
    json!({
        "version": 1,
        "event": &entry.activity_type,
        "category": entry.category,
        "title": &render.title,
        "message": &render.text,
        "user": {
            "id": &entry.actor_user_id,
            "displayName": &entry.actor_display_name,
        },
        "location": &entry.content.location,
        "worldId": &entry.content.world_id,
        "displayLocation": &entry.content.display_location,
        "worldName": &entry.content.world_name,
        "timestamp": &entry.created_at,
    })
}

fn discord_webhook_payload(
    delivery: &OverlayActivityDelivery,
    render: &RenderedNotification,
) -> Value {
    let entry = &delivery.entry;
    let description = if !entry.content.display_location.trim().is_empty() {
        format!("\u{2192} {}", entry.content.display_location)
    } else if !entry.content.world_name.trim().is_empty() {
        format!("\u{2192} {}", entry.content.world_name)
    } else if !render.body.trim().is_empty() {
        render.body.clone()
    } else {
        render.text.clone()
    };
    let thumbnail = if render.image_url.trim().is_empty() {
        json!({})
    } else {
        json!({ "url": render.image_url })
    };
    json!({
        "content": null,
        "embeds": [{
            "title": &render.text,
            "description": description,
            "thumbnail": thumbnail,
            "timestamp": &entry.created_at,
        }]
    })
}

fn non_empty(value: &str) -> Option<&str> {
    let value = value.trim();
    (!value.is_empty()).then_some(value)
}

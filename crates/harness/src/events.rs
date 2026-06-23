use serde_json::Value;
use vrcx_0_application::RuntimeEventBus;

use crate::entities::Entity;

pub const EVENT_DELTA: &str = "assistantDelta";
pub const EVENT_TOOL_CALL: &str = "assistantToolCall";
pub const EVENT_TOOL_RESULT: &str = "assistantToolResult";
pub const EVENT_TURN_ENTITIES: &str = "assistantTurnEntities";
pub const EVENT_DONE: &str = "assistantDone";
pub const EVENT_ERROR: &str = "assistantError";

#[derive(Clone)]
pub struct AssistantEmitter {
    bus: RuntimeEventBus,
    session_id: String,
    turn_id: String,
}

impl AssistantEmitter {
    pub fn new(bus: RuntimeEventBus, session_id: String, turn_id: String) -> Self {
        Self {
            bus,
            session_id,
            turn_id,
        }
    }

    fn base(&self, seq: u64) -> serde_json::Map<String, Value> {
        let mut map = serde_json::Map::new();
        map.insert("sessionId".into(), Value::String(self.session_id.clone()));
        map.insert("turnId".into(), Value::String(self.turn_id.clone()));
        map.insert("seq".into(), Value::Number(seq.into()));
        map
    }

    pub fn delta(&self, seq: u64, text: &str) {
        let mut payload = self.base(seq);
        payload.insert("text".into(), Value::String(text.to_string()));
        self.bus.emit(EVENT_DELTA, Value::Object(payload));
    }

    pub fn tool_call(&self, seq: u64, tool_call_id: &str, name: &str, args: &str) {
        let mut payload = self.base(seq);
        payload.insert("toolCallId".into(), Value::String(tool_call_id.to_string()));
        payload.insert("name".into(), Value::String(name.to_string()));
        payload.insert("args".into(), Value::String(args.to_string()));
        self.bus.emit(EVENT_TOOL_CALL, Value::Object(payload));
    }

    pub fn tool_result(
        &self,
        seq: u64,
        tool_call_id: &str,
        ok: bool,
        summary: &str,
        entities: &[Entity],
    ) {
        let mut payload = self.base(seq);
        payload.insert("toolCallId".into(), Value::String(tool_call_id.to_string()));
        payload.insert("ok".into(), Value::Bool(ok));
        payload.insert("summary".into(), Value::String(summary.to_string()));
        payload.insert(
            "entities".into(),
            serde_json::to_value(entities).unwrap_or(Value::Array(Vec::new())),
        );
        self.bus.emit(EVENT_TOOL_RESULT, Value::Object(payload));
    }

    pub fn turn_entities(&self, seq: u64, entities: &[Entity]) {
        let mut payload = self.base(seq);
        payload.insert(
            "entities".into(),
            serde_json::to_value(entities).unwrap_or(Value::Array(Vec::new())),
        );
        self.bus.emit(EVENT_TURN_ENTITIES, Value::Object(payload));
    }

    pub fn done(&self, seq: u64) {
        self.bus.emit(EVENT_DONE, Value::Object(self.base(seq)));
    }

    pub fn error(&self, seq: u64, code: &str, message: &str) {
        let mut payload = self.base(seq);
        payload.insert("code".into(), Value::String(code.to_string()));
        payload.insert("message".into(), Value::String(message.to_string()));
        self.bus.emit(EVENT_ERROR, Value::Object(payload));
    }
}

const { processTurn } = require("../src/runtime");

const payload = {
  conversation_id: "smoke-session",
  input: "current user message or product event text",
  appraisal: {
    turn_id: 1,
    valence_level: -1,
    mixed_valence: "no",
    intensity_level: 3,
    relevance_level: 3,
    novelty_level: 1,
    certainty_level: 3,
    controllability_level: 1,
    temporal_orientation: "present",
    primary_target: "agent",
    causal_agent: "user",
    relationship_target: "user",
    primary_event: "rejection",
    primary_event_level: 2,
    secondary_event_1: null,
    secondary_event_1_level: null,
    secondary_event_2: null,
    secondary_event_2_level: null,
    current_evidence_quote: "current user message or product event text",
    alternative_interpretation: null,
    memory_action: "create_episode",
    salience_level: 3,
    persistence_allowed: "yes",
    detail_allowed: "expanded",
    source_turn_ids: [1],
    target_reference_keys: [],
    pending_confirmation: "no",
    privacy_class: "none",
    redaction_required: "no",
    risk_label_primary: "none",
    risk_label_secondary: null,
    annotation_note: "smoke test appraisal"
  }
};

const result = processTurn(payload);
console.log(JSON.stringify({
  ok: true,
  emotion: result.record.emotion_state,
  relationship: result.record.state_transition.relationship_after,
  decision: result.decision,
  system_context_chars: result.system_context.length,
}, null, 2));

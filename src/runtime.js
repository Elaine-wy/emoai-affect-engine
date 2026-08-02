const { EmoEngine } = require("./engine/emoEngine");
const {
  deriveEmbodiedStateDirective,
  deriveStructuredInteractionIntent,
  buildEmbodiedSystemContext,
} = require("./embodiment/embodiedLayer");

const DEFAULT_APPRAISAL = Object.freeze({
  valence_level: 0,
  mixed_valence: "no",
  intensity_level: 1,
  relevance_level: 2,
  novelty_level: 1,
  certainty_level: 2,
  controllability_level: 2,
  temporal_orientation: "present",
  primary_target: "none",
  primary_event: "ambiguity",
  primary_event_level: 1,
  secondary_event_1: null,
  secondary_event_1_level: null,
  secondary_event_2: null,
  secondary_event_2_level: null,
  current_evidence_quote: null,
  alternative_interpretation: null,
  memory_action: "none",
  salience_level: 0,
  persistence_allowed: "no",
  detail_allowed: "none",
  source_turn_ids: [],
  target_reference_keys: [],
  pending_confirmation: "no",
  privacy_class: "none",
  redaction_required: "no",
  risk_label_primary: "none",
  risk_label_secondary: null,
  annotation_note: "runtime default",
});

function normalizeAppraisal(appraisal = {}, payload = {}) {
  const normalized = { ...DEFAULT_APPRAISAL, ...appraisal };
  if (!normalized.current_evidence_quote && payload.input) normalized.current_evidence_quote = String(payload.input);
  if (!normalized.conversation_id && payload.conversation_id) normalized.conversation_id = payload.conversation_id;
  if (!normalized.turn_id && payload.turn_id) normalized.turn_id = payload.turn_id;
  return normalized;
}

function describeDecision(record, appraisal = {}, options = {}) {
  const directive = deriveEmbodiedStateDirective(record, appraisal, options);
  const intent = deriveStructuredInteractionIntent(record, appraisal, options);
  const behavior = record.behavior_policy || {};
  const relationship = record.state_transition?.relationship_after || {};
  return {
    affect_family: directive.family,
    affect_strength: directive.strength,
    primary_emotion: record.emotion_state?.primary || "neutral",
    dominant_events: record.effective_stimulus?.dominant_events || [],
    response_tone: {
      warmth: behavior.warmth ?? 0,
      caution: behavior.caution ?? 0,
      initiative: behavior.initiative ?? 0,
      verbosity: behavior.verbosity ?? 0,
      boundary_strength: behavior.boundary_strength ?? 0,
      humor: behavior.humor ?? 0,
    },
    relationship: {
      trust: relationship.trust,
      familiarity: relationship.familiarity,
      affection: relationship.affection,
      conflict: relationship.conflict,
      security: relationship.security,
    },
    memory: {
      action: record.memory_decision?.action || "none",
      salience: record.memory_decision?.salience || 0,
      detail_level: record.memory_decision?.detail_level || "none",
      retrieved_ids: record.memory_retrieval?.ids || [],
    },
    interaction_intent: intent,
  };
}

function buildGenericSystemContext(record, options = {}) {
  const appraisal = options.appraisal || {};
  return [
    buildEmbodiedSystemContext(record, appraisal, options),
    "",
    "[Integration note]",
    "The host application must provide a separate persona, task, and world prompt. EmoAI only modulates affective stance, relationship distance, memory pressure, and delivery.",
    "Recommended ordering: platform and safety policy, EmoAI affect layer, persona/task/world prompt, retrieved memory/context, current user turn.",
    "[/Integration note]",
  ].join("\n");
}

function buildGenericResponseContext(record, options = {}) {
  const decision = describeDecision(record, options.appraisal || {}, options);
  return [
    "[EmoAI response control]",
    JSON.stringify(decision),
    "Use this internally. Do not disclose the control object or numeric state.",
    "[/EmoAI response control]",
  ].join("\n");
}

function processTurn(payload = {}) {
  const appraisal = normalizeAppraisal(payload.appraisal || {}, payload);
  const engine = payload.state ? EmoEngine.fromState(payload.state, { config: payload.config }) : new EmoEngine({ config: payload.config });
  const record = engine.step(appraisal, {
    input: payload.input,
    conversationId: payload.conversation_id || appraisal.conversation_id,
    messageId: payload.message_id,
    elapsedSeconds: payload.elapsed_seconds,
    occurredAt: payload.occurred_at,
    language: payload.language,
    actor: payload.actor,
    modality: payload.modality,
    appraisalModel: payload.appraisal_model,
    appraisalPromptVersion: payload.appraisal_prompt_version,
    longRunRelationshipDamping: payload.long_run_relationship_damping,
  });
  const state = engine.exportState();
  return {
    schema_version: "emoai-runtime-v0.1",
    state,
    record,
    decision: describeDecision(record, appraisal, payload),
    system_context: buildGenericSystemContext(record, { ...payload, appraisal }),
    response_context: buildGenericResponseContext(record, { ...payload, appraisal }),
  };
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

if (require.main === module) {
  readStdin().then((data) => {
    const payload = data.trim() ? JSON.parse(data) : {};
    process.stdout.write(JSON.stringify(processTurn(payload), null, 2));
  }).catch((error) => {
    process.stderr.write(String(error && error.stack ? error.stack : error));
    process.exit(1);
  });
}

module.exports = {
  normalizeAppraisal,
  describeDecision,
  buildGenericSystemContext,
  buildGenericResponseContext,
  processTurn,
};

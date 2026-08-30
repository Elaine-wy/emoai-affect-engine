const assert = require("node:assert");
const { processTurn } = require("../src/runtime");

function appraisal(overrides) {
  return {
    turn_id: 1,
    valence_level: 0,
    mixed_valence: "no",
    intensity_level: 0,
    relevance_level: 1,
    novelty_level: 0,
    certainty_level: 3,
    controllability_level: 2,
    temporal_orientation: "present",
    primary_target: "none",
    causal_agent: "unknown",
    relationship_target: "none",
    primary_event: "ambiguity",
    primary_event_level: 0,
    secondary_event_1: null,
    secondary_event_1_level: null,
    secondary_event_2: null,
    secondary_event_2_level: null,
    current_evidence_quote: "current user message or product event text",
    alternative_interpretation: null,
    memory_action: "none",
    salience_level: 1,
    persistence_allowed: "no",
    detail_allowed: "none",
    source_turn_ids: [],
    target_reference_keys: [],
    pending_confirmation: "no",
    privacy_class: "none",
    redaction_required: "no",
    risk_label_primary: "none",
    risk_label_secondary: null,
    annotation_note: "regression",
    expectation_violation: "unknown",
    implicit_relational_signal: "unknown",
    prior_event_reference: null,
    repair_quality: "none",
    attribution_confidence: 3,
    ...overrides,
  };
}

let neutral = processTurn({
  conversation_id: "regression-neutral",
  input: "current user message or product event text",
  appraisal: appraisal({ turn_id: 1 }),
});
assert.equal(neutral.decision.affect_control.mode, "quiet");
assert.equal(neutral.decision.decision_contract.affect_visibility, "background");

const externalSetback = processTurn({
  conversation_id: "regression-external-setback",
  input: "current user message or product event text",
  appraisal: appraisal({
    turn_id: 1,
    valence_level: -2,
    intensity_level: 4,
    relevance_level: 4,
    novelty_level: 3,
    controllability_level: 1,
    primary_target: "agent",
    causal_agent: "shared_task",
    relationship_target: null,
    primary_event: "goal_block",
    primary_event_level: 3,
    memory_action: "create_episode",
    salience_level: 4,
    persistence_allowed: "yes",
    detail_allowed: "expanded",
  }),
});
assert.equal(externalSetback.record.event_attribution.causal_agent, "shared_task");
assert.equal(externalSetback.record.event_attribution.relationship_eligible, false);
assert.deepEqual(
  externalSetback.record.state_transition.relationship_after,
  externalSetback.record.state_transition.relationship_before,
);
assert.equal(externalSetback.decision.affect_family, "task_strained");
assert.equal(externalSetback.decision.interaction_intent.relationship_distance, "neutral");
assert.equal(externalSetback.decision.interaction_intent.interaction_move, "stay_on_task_with_visible_strain");

const externalRecovery = processTurn({
  conversation_id: "regression-external-setback",
  state: externalSetback.state,
  input: "current user message or product event text",
  appraisal: appraisal({
    turn_id: 2,
    valence_level: 1,
    intensity_level: 1,
    relevance_level: 1,
    controllability_level: 4,
    primary_target: "shared_task",
    causal_agent: "shared_task",
    relationship_target: "none",
    primary_event: "goal_progress",
    primary_event_level: 1,
  }),
});
assert.equal(externalRecovery.decision.affect_control.mode, "quiet");
assert.equal(externalRecovery.decision.interaction_intent.relationship_distance, "neutral");

let strong = processTurn({
  conversation_id: "regression-strong",
  input: "current user message or product event text",
  appraisal: appraisal({
    turn_id: 1,
    valence_level: -2,
    intensity_level: 4,
    relevance_level: 4,
    controllability_level: 0,
    primary_target: "agent",
    causal_agent: "user",
    relationship_target: "user",
    primary_event: "rejection",
    primary_event_level: 3,
    memory_action: "create_episode",
    salience_level: 4,
    persistence_allowed: "yes",
    detail_allowed: "central_rich",
    implicit_relational_signal: "negative",
    expectation_violation: "yes",
  }),
});
assert.equal(strong.decision.affect_control.mode, "explicit");
assert.equal(strong.decision.decision_contract.affect_visibility, "explicit");
assert.equal(strong.decision.decision_contract.first_person_affect, "required_once");
assert.ok(strong.record.relational_residue.after.hurt > 0.2);

const firstRepair = processTurn({
  conversation_id: "regression-strong",
  state: strong.state,
  input: "current user message or product event text",
  appraisal: appraisal({
    turn_id: 2,
    valence_level: 1,
    intensity_level: 2,
    relevance_level: 3,
    primary_target: "agent",
    causal_agent: "user",
    relationship_target: "user",
    primary_event: "repair_signal",
    primary_event_level: 2,
    implicit_relational_signal: "positive",
    repair_quality: "credible",
    memory_action: "resolve_episode",
    persistence_allowed: "yes",
    detail_allowed: "summary",
  }),
});
assert.notEqual(firstRepair.decision.interaction_intent.relationship_distance, "neutral");
assert.equal(firstRepair.decision.interaction_intent.interaction_move, "accept_repair_without_reset");

let state = strong.state;
let residueAtTurnSix = null;
for (let turn = 2; turn <= 6; turn += 1) {
  const next = processTurn({
    conversation_id: "regression-strong",
    state,
    input: "current user message or product event text",
    appraisal: appraisal({
      turn_id: turn,
      valence_level: 0,
      intensity_level: 1,
      relevance_level: 2,
      primary_target: "agent",
      causal_agent: "user",
      relationship_target: "user",
      primary_event: "ambiguity",
      primary_event_level: 1,
      implicit_relational_signal: "negative",
      prior_event_reference: "previous-unresolved-event",
      memory_action: "extend_episode",
      salience_level: 2,
      persistence_allowed: "yes",
      detail_allowed: "summary",
    }),
  });
  state = next.state;
  if (turn === 6) {
    assert.notEqual(next.decision.affect_control.mode, "quiet");
    assert.ok(next.decision.affect_control.residue > 0.1);
    residueAtTurnSix = next.record.relational_residue.after;
  }
}

const repair = processTurn({
  conversation_id: "regression-strong",
  state,
  input: "current user message or product event text",
  appraisal: appraisal({
    turn_id: 7,
    valence_level: 1,
    intensity_level: 2,
    relevance_level: 3,
    primary_target: "agent",
    causal_agent: "user",
    relationship_target: "user",
    primary_event: "repair_signal",
    primary_event_level: 2,
    implicit_relational_signal: "positive",
    repair_quality: "credible",
    memory_action: "resolve_episode",
    persistence_allowed: "yes",
    detail_allowed: "summary",
  }),
});
assert.ok(repair.record.relational_residue.after.hurt < residueAtTurnSix.hurt);
assert.ok(repair.record.relational_residue.after.hurt > 0);
assert.ok(repair.record.relational_residue.after.unresolved_memory < residueAtTurnSix.unresolved_memory);

console.log(JSON.stringify({
  ok: true,
  neutral_mode: neutral.decision.affect_control.mode,
  strong_mode: strong.decision.affect_control.mode,
  strong_trigger: strong.decision.affect_control.trigger,
  residue_after_strong: strong.record.relational_residue.after,
  repair_residue: repair.record.relational_residue.after,
}, null, 2));

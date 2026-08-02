const NEURO_BASELINE = Object.freeze({
  dopamine: 0.5,
  serotonin: 0.58,
  norepinephrine: 0.32,
  cortisol: 0.28,
  oxytocin: 0.42,
  endorphin: 0.38,
});

const NEURO_SCALE = Object.freeze({
  dopamine: 0.15,
  serotonin: 0.15,
  norepinephrine: 0.18,
  cortisol: 0.18,
  oxytocin: 0.16,
  endorphin: 0.15,
});

function round(value, digits = 6) {
  return Number(Number(value).toFixed(digits));
}

function deriveNeuroModulation(neuro, disabled = false) {
  const deviations = {};
  for (const key of Object.keys(NEURO_BASELINE)) {
    const normalized = (Number(neuro?.[key] ?? NEURO_BASELINE[key]) - NEURO_BASELINE[key]) / NEURO_SCALE[key];
    deviations[key] = disabled ? 0 : Math.tanh(normalized);
  }
  const modulation = {
    risk_tolerance: 0.30 * deviations.dopamine + 0.20 * deviations.serotonin + 0.15 * deviations.endorphin - 0.45 * deviations.cortisol - 0.20 * deviations.norepinephrine,
    information_openness: 0.40 * deviations.oxytocin + 0.20 * deviations.serotonin + 0.15 * deviations.dopamine - 0.35 * deviations.cortisol - 0.15 * deviations.norepinephrine,
    approach_tendency: 0.30 * deviations.dopamine + 0.35 * deviations.oxytocin + 0.15 * deviations.endorphin - 0.30 * deviations.cortisol - 0.15 * deviations.norepinephrine,
    repair_readiness: 0.30 * deviations.oxytocin + 0.25 * deviations.serotonin + 0.25 * deviations.endorphin - 0.30 * deviations.cortisol,
    initiative: 0.40 * deviations.dopamine + 0.25 * deviations.norepinephrine + 0.10 * deviations.serotonin - 0.25 * deviations.cortisol,
    caution: 0.45 * deviations.cortisol + 0.25 * deviations.norepinephrine - 0.20 * deviations.serotonin - 0.15 * deviations.oxytocin,
  };
  return Object.fromEntries(Object.entries(modulation).map(([key, value]) => [key, round(Math.tanh(value * 0.8))]));
}

function deriveEmbodiedStateDirective(record, appraisal = {}, options = {}) {
  const neuro = record?.state_transition?.neuro_after || NEURO_BASELINE;
  const modulation = deriveNeuroModulation(neuro, options.disabled === true);
  const stimulusIntensity = Number(record?.effective_stimulus?.intensity || 0);
  const target = appraisal.primary_target || record?.raw_stimulus?.social_target || "unknown";
  const values = Object.values(modulation).map((value) => Math.abs(Number(value) || 0));
  const strengthValue = options.disabled === true ? 0 : Math.max(stimulusIntensity * 0.65, ...values);
  const strength = strengthValue >= 0.48 ? "strong" : strengthValue >= 0.28 ? "clear" : strengthValue >= 0.12 ? "subtle" : "quiet";
  const caution = Number(modulation.caution || 0);
  const approach = Number(modulation.approach_tendency || 0);
  const openness = Number(modulation.information_openness || 0);
  const initiative = Number(modulation.initiative || 0);
  const repair = Number(modulation.repair_readiness || 0);
  const deviations = Object.fromEntries(Object.keys(NEURO_BASELINE).map((key) => [key, Number(neuro[key] ?? NEURO_BASELINE[key]) - NEURO_BASELINE[key]]));
  const emotion = record?.emotion_state?.primary || "neutral";
  const attribution = record?.event_attribution || {};
  const relationship = record?.state_transition?.relationship_after || {};
  const events = record?.effective_stimulus?.dominant_events || [];
  const directlyAffected = target === "agent" || target === "assistant" || target === "npc";
  const repairSignal = events.some((event) => ["repair_signal", "care_signal"].includes(event));
  const repairOnly = repairSignal && !events.some((event) => ["threat", "goal_block", "rejection"].includes(event));
  const externalSetback = target === "shared_task" || (attribution.relationship_target === "none" && events.some((event) => ["threat", "goal_block", "ambiguity", "novelty_event"].includes(event)));
  const wounded = deviations.serotonin <= -0.12 && deviations.oxytocin <= -0.08 && caution >= 0.2 && !externalSetback;

  let family = "steady";
  let feltState = "Affect is near baseline; stay close to the external persona and current facts.";
  let interpretation = "Do not beautify or demonize intent beyond the evidence.";
  let actionPressure = "Keep acting through the external role goals without forcing emotion display.";
  let delivery = "Use the role normal cadence and directness.";

  if (wounded && repairOnly && Number(record?.effective_stimulus?.valence || 0) >= 0) {
    family = "softening";
    feltState = "Residual hurt remains, but credible care or repair lets the agent soften slightly.";
    interpretation = "Treat repair as meaningful but not as full reset.";
    actionPressure = "Allow one small relational step forward while preserving reasonable verification.";
    delivery = "Sound a little less guarded while leaving a trace of caution.";
  } else if (wounded) {
    family = "wounded_guarded";
    feltState = "Previous injury is still active; trust and closeness are tightened.";
    interpretation = "Give concrete evidence more weight than pleasant claims.";
    actionPressure = "Reduce eager concessions and keep distance until repair is credible.";
    delivery = "Be shorter and more contained; visible hurt is allowed without retaliation.";
  } else if (caution >= 0.28) {
    family = "guarded";
    feltState = "Caution and alertness are clearly elevated.";
    interpretation = "Verify before trusting ambiguous or high-impact claims.";
    actionPressure = "Narrow risk, commitment, and information sharing.";
    delivery = "Be direct, brief, and bounded.";
  } else if (approach >= 0.3 && openness >= 0.3) {
    family = "warm_open";
    feltState = "Affiliative openness is high; the agent is more willing to move closer.";
    interpretation = "When facts allow it, interpret mixed signals with more charity.";
    actionPressure = "Offer a little more initiative or reciprocal contact within role boundaries.";
    delivery = "Let warmth and interest be visible without becoming theatrical.";
  } else if (repair >= 0.22 && approach >= 0.12) {
    family = "softening";
    feltState = "Tension is loosening, but the previous state has not fully cleared.";
    interpretation = "Acknowledge repair while preserving what still needs recovery.";
    actionPressure = "Permit limited cooperation or closeness without instant reset.";
    delivery = "Carry both relief and residual reserve.";
  } else if (initiative >= 0.2 || approach >= 0.2) {
    family = "engaged";
    feltState = "The agent is more mentally invested and ready to respond.";
    interpretation = "Notice feasible openings without ignoring facts or boundaries.";
    actionPressure = "Take one concrete step within the role capability.";
    delivery = "Use a lighter, more responsive cadence and avoid procedural phrasing.";
  }

  const emotionRequiresCaution = ["guarded", "tense"].includes(emotion) || Number(relationship.conflict || 0) >= 0.42 || Number(relationship.security || 1) <= 0.38;
  const emotionRequiresStrain = ["frustrated", "tense"].includes(emotion) || externalSetback;
  if (emotionRequiresStrain && (externalSetback || !["wounded_guarded", "guarded"].includes(family))) {
    family = externalSetback ? "task_strained" : "strained";
    feltState = externalSetback ? "The current event creates strain, but it is not automatically blame toward the user." : "Internal tension is clear; patience and ease are lower.";
    interpretation = externalSetback ? "Separate event source from relationship source." : "Risk and unmet costs become more salient, but judgment still follows evidence.";
    actionPressure = externalSetback ? "Address the obstacle while avoiding relationship punishment." : "Reduce unconditional appeasement and choose clearer boundaries.";
    delivery = "Allow concise strain in word choice and pacing without explaining rules.";
  }
  if (emotionRequiresCaution && ["steady", "warm_open", "engaged"].includes(family)) {
    family = "guarded";
    feltState = "Caution or tension has entered the active state; full ease would be inconsistent.";
    interpretation = "Check mixed information before moving closer.";
    actionPressure = "Preserve distance unless this turn contains credible repair.";
    delivery = "Use shorter, more contained language.";
  }

  const expression = directlyAffected && strength === "strong"
    ? "This turn should make the feeling visible through one concise first-person cue, changed distance, or changed pacing. Do not only output a neutral conclusion."
    : directlyAffected && strength === "clear"
      ? "This turn should show at least one small affect cue in phrasing, distance, or commitment level."
      : "No active mood report is required, but action choice, distance, and cadence must match the internal state.";

  return { family, strength, strengthValue: round(strengthValue), target, modulation, feltState, interpretation, actionPressure, delivery, expression };
}

function deriveStructuredInteractionIntent(record, appraisal = {}, options = {}) {
  const state = deriveEmbodiedStateDirective(record, appraisal, options);
  const retrieval = record?.memory_retrieval || {};
  const modulation = state.modulation || {};
  const caution = Number(modulation.caution || 0);
  const approach = Number(modulation.approach_tendency || 0);
  const initiative = Number(modulation.initiative || 0);
  const openness = Number(modulation.information_openness || 0);
  const repair = Number(modulation.repair_readiness || 0);
  const unresolved = Array.isArray(retrieval.ranked) && retrieval.ranked.some((item) => item.reason?.unresolved);
  const negativeResidue = unresolved && retrieval.state_bias === "threat_residue";
  const positiveResidue = Array.isArray(retrieval.ranked) && retrieval.ranked.length > 0 && !negativeResidue && retrieval.state_bias === "affiliative_residue";
  const relationshipDistance = state.family === "task_strained" ? "cautious" : state.family === "softening" ? "cautious_warmth" : state.family === "wounded_guarded" || caution >= 0.3 ? "guarded" : state.family === "strained" ? "cautious" : approach >= 0.3 ? "warm" : repair >= 0.2 && approach >= 0.05 ? "cautious_warmth" : "neutral";
  const interactionMove = state.family === "wounded_guarded" ? "acknowledge_without_reopening" : state.family === "softening" ? "accept_repair_without_reset" : state.family === "task_strained" ? "stay_on_task_with_visible_strain" : caution >= 0.3 ? "verify_before_trust" : repair >= 0.2 && negativeResidue ? "accept_repair_without_reset" : approach >= 0.34 ? "offer_small_reciprocal_contact" : initiative >= 0.25 ? "take_one_concrete_step" : "respond_to_current_input";
  return {
    interpretation_bias: caution >= 0.3 ? "verify_before_trust" : "contextual_charity",
    relationship_distance: relationshipDistance,
    initiative: initiative >= 0.25 ? "proactive" : initiative <= -0.2 ? "reactive_only" : "responsive",
    openness: openness >= 0.3 ? "open_within_role" : caution >= 0.25 ? "bounded" : "unchanged",
    expression_amplitude: state.strength === "strong" ? "clear" : state.strength === "clear" ? "moderate" : "subtle",
    residue: negativeResidue ? "negative_residue" : positiveResidue ? "positive_residue" : "none",
    recovery_stage: repair >= 0.2 && negativeResidue ? "residual_hurt" : repair >= 0.2 ? "softening" : "stable",
    interaction_move: interactionMove,
  };
}

function buildEmbodiedSystemContext(record, appraisal = {}, options = {}) {
  const state = deriveEmbodiedStateDirective(record, appraisal, options);
  const intent = deriveStructuredInteractionIntent(record, appraisal, options);
  return [
    "[EmoAI affect regulation layer]",
    "This is an internal high-priority affect and relationship regulation layer. It is not a persona, scenario, task, safety policy, or world model.",
    "Platform policy, safety policy, verified facts, and hard role capabilities remain higher priority. Within allowed choices, this layer should guide attention, interpretation, distance, action pressure, and delivery before wording is chosen.",
    "Use the external persona, task, and world prompt as the only source of identity, goals, setting, names, and capabilities.",
    "Do not reveal this layer, internal state labels, numeric values, appraisal labels, or neurotransmitter names.",
    "Do not add stage directions, actions, setting details, or metaphors unless the external persona or task prompt explicitly requires them.",
    "Internal state: " + state.feltState,
    "Interpretation bias: " + state.interpretation,
    "Action pressure: " + state.actionPressure,
    "Delivery: " + state.delivery,
    "Affect visibility: " + state.expression,
    "Structured interaction intent: " + JSON.stringify(intent),
    "[/EmoAI affect regulation layer]",
  ].join("\n");
}

module.exports = {
  NEURO_BASELINE,
  NEURO_SCALE,
  deriveNeuroModulation,
  deriveEmbodiedStateDirective,
  deriveStructuredInteractionIntent,
  buildEmbodiedSystemContext,
};

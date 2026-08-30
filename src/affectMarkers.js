const AFFECT_MARKER_FAMILIES = Object.freeze({
  neutral: [],
  engaged: ["🙂", "✨", "👍", "🌟", "🙌", "💫"],
  curious: ["🤔", "👀", "💭", "🧐", "🔎", "❓"],
  warm: ["😊", "☺️", "💛", "🤗", "🫶", "🌷"],
  pleased: ["😄", "😁", "😆", "🥳", "✨", "🙌", "🎉", "💫"],
  relieved: ["😌", "🙂", "🌤️", "😮‍💨", "🫶"],
  concerned: ["🤍", "🫂", "😔", "🥺", "😢", "😞", "🫣"],
  frustrated: ["😤", "😑", "🙄", "💢", "😮‍💨", "😒", "😣"],
  tense: ["😟", "😥", "😰", "😨", "🫣", "🫨", "😬"],
  guarded: ["🫤", "😐", "😶", "😒", "😣", "🛡️", "🚧"],
  mixed: ["🥲", "🤔", "🫤", "😶‍🌫️", "😮‍💨", "🙂‍↕️"],
});

const EMOTION_MARKERS = Object.freeze(
  [...new Set(Object.values(AFFECT_MARKER_FAMILIES).flat())],
);

function round(value, digits = 6) {
  return Number(Number(value).toFixed(digits));
}

function stableFraction(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function chooseDifferent(candidates, preferred, previous) {
  if (preferred !== previous || candidates.length < 2) return preferred;
  const index = candidates.indexOf(preferred);
  return candidates[(index + 1) % candidates.length];
}

/**
 * Select one optional UI marker from the engine's state transition.
 * This module never classifies raw text and never changes engine state.
 */
function selectAffectMarkerDecision(record, previousState = {}, options = {}) {
  const semanticGuards = Array.isArray(options.semanticGuards) ? options.semanticGuards : [];
  const none = (reason, family = record?.emotion_state?.primary || null, dominantChanges = []) => ({
    marker: null,
    family,
    reason,
    dominant_changes: dominantChanges,
  });

  if (options.enabled === false || options.textOnly === true) return none("disabled");
  const risks = record?.safety?.risk_labels || [];
  if (risks.length > 0 || record?.safety?.policy_override) return none("safety_suppressed");

  const venting = semanticGuards.includes("emotional_venting_no_advice");
  const intensity = Math.max(
    Number(record?.effective_stimulus?.intensity || 0),
    Number(record?.emotion_state?.intensity || 0),
  );
  if (venting && intensity < 0.7) return none("venting_suppressed");
  if (semanticGuards.includes("assistant_output_feedback_user_centered")) {
    return none("repair_feedback_suppressed");
  }

  const emotion = record?.emotion_state?.primary || "neutral";
  const family = AFFECT_MARKER_FAMILIES[emotion] || [];
  if (!family.length) return none("neutral_or_unsupported", emotion);

  const transition = record?.state_transition || {};
  const before = transition.neuro_before || {};
  const after = transition.neuro_after || {};
  const net = Object.fromEntries(Object.keys(after).map((key) => [
    key,
    Number(after[key] || 0) - Number(before[key] || 0),
  ]));
  const stressChange = ((net.norepinephrine || 0) + (net.cortisol || 0)) / 2;
  const relationship = transition.relationship_after || {};
  const closeness = (Number(relationship.familiarity || 0) + Number(relationship.affection || 0)) / 2;
  const primaryEvent = record?.raw_stimulus?.primary_event
    || record?.effective_stimulus?.dominant_events?.[0]
    || null;
  const dominantChanges = Object.entries(net)
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
    .slice(0, 3)
    .map(([key, value]) => ({
      key,
      direction: value >= 0 ? "up" : "down",
      magnitude: round(Math.abs(value)),
    }));

  if (Number(previousState?.affect_marker_streak || 0) >= 3 && intensity < 0.55) {
    return none("repetition_suppressed", emotion, dominantChanges);
  }

  let eligible = [...family];
  if (emotion === "concerned" && closeness < 0.55) eligible = eligible.filter((marker) => marker !== "🫂");
  if (emotion === "warm" && closeness < 0.55) eligible = eligible.filter((marker) => marker !== "💛");

  let preferred = eligible[0];
  if (emotion === "concerned") {
    if ((net.oxytocin || 0) >= 0.02 && closeness >= 0.55) preferred = "🫂";
    else if (primaryEvent === "threat" && stressChange >= 0.07) preferred = "😰";
    else if (["rejection", "goal_block"].includes(primaryEvent) && (net.serotonin || 0) <= -0.02) preferred = "🥺";
    else if (stressChange >= 0.055) preferred = "😔";
    else if (intensity >= 0.65) preferred = "😞";
  } else if (emotion === "warm") {
    if ((net.oxytocin || 0) >= 0.03 && closeness >= 0.55) preferred = "💛";
    else if ((net.oxytocin || 0) >= 0.025) preferred = "🫶";
    else preferred = (net.oxytocin || 0) >= 0.015 ? "😊" : "☺️";
  } else if (emotion === "pleased") {
    preferred = (net.dopamine || 0) >= 0.04 ? "😄" : "✨";
  } else if (emotion === "relieved") {
    preferred = stressChange <= -0.04 ? "😮‍💨" : stressChange <= -0.025 ? "😌" : "🌤️";
  } else if (emotion === "curious") {
    preferred = (record?.effective_stimulus?.events?.novelty_event || 0) >= 0.3 ? "👀" : "🤔";
  } else if (emotion === "frustrated") {
    if (primaryEvent === "goal_block" && intensity >= 0.7 && stressChange >= 0.04) preferred = "💢";
    else if (stressChange >= 0.055 || (net.norepinephrine || 0) >= 0.045) preferred = "😤";
    else if (stressChange >= 0.035) preferred = "😮‍💨";
    else preferred = "😑";
  } else if (emotion === "tense") {
    if (primaryEvent === "threat" && intensity >= 0.72) preferred = "😨";
    else if (stressChange >= 0.065) preferred = "😰";
    else if (stressChange >= 0.04) preferred = "😥";
    else preferred = "😟";
  } else if (emotion === "guarded") {
    if (record?.behavior_policy?.boundary_strength >= 0.5) preferred = "🛡️";
    else if (primaryEvent === "rejection" && intensity >= 0.7) preferred = "😣";
    else if ((net.oxytocin || 0) < -0.02) preferred = "🫤";
    else if (stressChange >= 0.04) preferred = "😒";
    else preferred = "😐";
  } else if (emotion === "mixed") {
    preferred = (net.oxytocin || 0) > 0 && stressChange > 0 ? "🥲" : "🤔";
  }

  if (!eligible.includes(preferred)) preferred = eligible[0];
  preferred = chooseDifferent(eligible, preferred, previousState?.last_affect_marker || null);
  return {
    marker: preferred,
    family: emotion,
    reason: "neuro_transition",
    dominant_changes: dominantChanges,
  };
}

function selectAffectMarker(record, previousState = {}, options = {}) {
  return selectAffectMarkerDecision(record, previousState, options).marker;
}

module.exports = {
  AFFECT_MARKER_FAMILIES,
  EMOTION_MARKERS,
  selectAffectMarker,
  selectAffectMarkerDecision,
};

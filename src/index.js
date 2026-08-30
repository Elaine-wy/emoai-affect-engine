const { EmoEngine, clamp, parseList, canonicalTarget } = require("./engine/emoEngine");
const {
  NEURO_BASELINE,
  NEURO_SCALE,
  deriveNeuroModulation,
  deriveEmbodiedStateDirective,
  deriveStructuredInteractionIntent,
  deriveAffectExpressionPlan,
  buildEmbodiedSystemContext,
} = require("./embodiment/embodiedLayer");
const {
  normalizeAppraisal,
  describeDecision,
  buildGenericSystemContext,
  buildGenericResponseContext,
  processTurn,
} = require("./runtime");
const {
  AFFECT_MARKER_FAMILIES,
  EMOTION_MARKERS,
  selectAffectMarker,
  selectAffectMarkerDecision,
} = require("./affectMarkers");

module.exports = {
  EmoEngine,
  clamp,
  parseList,
  canonicalTarget,
  NEURO_BASELINE,
  NEURO_SCALE,
  deriveNeuroModulation,
  deriveEmbodiedStateDirective,
  deriveStructuredInteractionIntent,
  deriveAffectExpressionPlan,
  buildEmbodiedSystemContext,
  AFFECT_MARKER_FAMILIES,
  EMOTION_MARKERS,
  selectAffectMarker,
  selectAffectMarkerDecision,
  normalizeAppraisal,
  describeDecision,
  buildGenericSystemContext,
  buildGenericResponseContext,
  processTurn,
};

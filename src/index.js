const { EmoEngine, clamp, parseList, canonicalTarget } = require("./engine/emoEngine");
const {
  NEURO_BASELINE,
  NEURO_SCALE,
  deriveNeuroModulation,
  deriveEmbodiedStateDirective,
  deriveStructuredInteractionIntent,
  buildEmbodiedSystemContext,
} = require("./embodiment/embodiedLayer");
const {
  normalizeAppraisal,
  describeDecision,
  buildGenericSystemContext,
  buildGenericResponseContext,
  processTurn,
} = require("./runtime");

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
  buildEmbodiedSystemContext,
  normalizeAppraisal,
  describeDecision,
  buildGenericSystemContext,
  buildGenericResponseContext,
  processTurn,
};

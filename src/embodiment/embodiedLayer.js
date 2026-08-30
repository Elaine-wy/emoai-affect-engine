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

const EMOTION_LABELS = Object.freeze({
  neutral: "平稳",
  engaged: "投入",
  curious: "好奇",
  warm: "亲近",
  pleased: "高兴",
  relieved: "松了一口气",
  concerned: "担心",
  frustrated: "受挫和烦躁",
  tense: "紧张不安",
  guarded: "戒备",
  hurt: "受伤",
  mixed: "复杂而矛盾",
});

const FAMILY_FEELINGS = Object.freeze({
  steady: "情绪相对平稳，但仍以角色自己的立场参与眼前互动",
  engaged: "投入感正在上升，也更愿意主动回应",
  warm_open: "亲近和放松感增强，愿意让对方感到被接纳",
  task_strained: "因任务或环境受挫而紧绷，但不把责任推给玩家",
  strained: "耐心和松弛度下降，内在紧绷已经可感",
  guarded: "关系戒心升高，需要先确认事实再靠近",
  wounded_guarded: "先前的伤害仍在，信任和亲近感明显收紧",
  softening: "紧绷正在松动，但旧感受还没有完全过去",
});

const TRAJECTORY_LABELS = Object.freeze({
  rising: "正在增强",
  holding: "仍在持续",
  easing: "正在缓解但尚未消失",
  reigniting: "被新刺激再次唤起",
  steady: "保持平稳",
});

function round(value, digits = 6) {
  return Number(Number(value).toFixed(digits));
}

function deriveActiveEvents(record) {
  const stimulus = record?.effective_stimulus || {};
  if (Array.isArray(stimulus.dominant_events) && stimulus.dominant_events.length > 0) {
    return stimulus.dominant_events;
  }
  return Object.entries(stimulus.events || {})
    .filter(([, level]) => Number(level) > 0)
    .sort((left, right) => Number(right[1]) - Number(left[1]))
    .map(([event]) => event);
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
  const affectMode = options.disabled === true ? "quiet" : (record?.affect_control?.mode || "quiet");
  const affectResidue = options.disabled === true ? 0 : Number(record?.affect_control?.residue || 0);
  const deviations = Object.fromEntries(Object.keys(NEURO_BASELINE).map((key) => [key, Number(neuro[key] ?? NEURO_BASELINE[key]) - NEURO_BASELINE[key]]));
  const emotion = record?.emotion_state?.primary || "neutral";
  const attribution = record?.event_attribution || {};
  const relationship = record?.state_transition?.relationship_after || {};
  const events = deriveActiveEvents(record);
  const repairSignal = events.some((event) => ["repair_signal", "care_signal"].includes(event));
  const repairOnly = repairSignal && !events.some((event) => ["threat", "goal_block", "rejection"].includes(event));
  const externalSetback = attribution.relationship_eligible === false
    && events.some((event) => ["threat", "goal_block", "ambiguity", "novelty_event"].includes(event));
  const residueState = record?.relational_residue?.after || {};
  const relationshipDebt = Math.max(
    Number(residueState.hurt || 0),
    Number(residueState.trust_debt || 0),
    Number(residueState.conflict_debt || 0),
  );
  const currentRelationshipHarm = attribution.relationship_eligible === true
    && Number(record?.effective_stimulus?.valence || 0) < -0.15
    && events.some((event) => ["threat", "rejection", "dominance", "goal_block"].includes(event));
  const relationshipThreatActive = currentRelationshipHarm || relationshipDebt >= 0.14;
  const wounded = relationshipThreatActive
    && deviations.serotonin <= -0.12
    && deviations.oxytocin <= -0.08
    && caution >= 0.2;

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
    family = relationshipThreatActive ? "guarded" : "task_strained";
    feltState = relationshipThreatActive
      ? "Caution and alertness are clearly elevated toward the relationship situation."
      : "Residual task or world pressure keeps alertness elevated without implying distrust of the user.";
    interpretation = relationshipThreatActive
      ? "Verify before trusting ambiguous or high-impact relationship claims."
      : "Keep evaluating the obstacle while treating the user relationship according to its own evidence.";
    actionPressure = relationshipThreatActive
      ? "Narrow risk, commitment, and information sharing."
      : "Reduce task risk without reducing warmth or trust toward the user by default.";
    delivery = "Be direct and brief; do not turn task strain into interpersonal coldness.";
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
    family = relationshipThreatActive ? "guarded" : "task_strained";
    feltState = relationshipThreatActive
      ? "Caution or tension has entered the relationship state; full ease would be inconsistent."
      : "Caution remains in the task state, but it is not evidence against the user.";
    interpretation = relationshipThreatActive
      ? "Check mixed relationship information before moving closer."
      : "Keep task judgment cautious while preserving the current relationship stance.";
    actionPressure = relationshipThreatActive
      ? "Preserve distance unless this turn contains credible repair."
      : "Continue carefully without imposing distance on the user.";
    delivery = "Use shorter, contained language without unnecessary interpersonal coldness.";
  }

  const expression = affectMode === "quiet"
    ? "Keep a perceivable emotional undertone through cadence, word choice, and relational stance; a small first-person feeling is allowed when natural."
    : affectMode === "implicit"
      ? "Make the feeling subtly perceivable through phrasing, rhythm, distance, or reciprocity; naming it is allowed when that sounds natural for the role."
      : affectMode === "clear"
        ? "Include one natural subjective reaction or concise first-person feeling, then continue through the role's own priorities."
        : "State the strong feeling directly once in the role's own voice and let it affect stance, commitment, or boundaries without turning it into a report.";

  return { family, strength, strengthValue: round(strengthValue), target, affectMode, modulation, feltState, interpretation, actionPressure, delivery, expression };
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
  const affectMode = options.disabled === true ? "quiet" : (record?.affect_control?.mode || "quiet");
  const affectResidue = options.disabled === true ? 0 : Number(record?.affect_control?.residue || 0);
  const attribution = record?.event_attribution || {};
  const residueState = record?.relational_residue?.after || {};
  const relationshipDebt = Math.max(
    Number(residueState.hurt || 0),
    Number(residueState.trust_debt || 0),
    Number(residueState.conflict_debt || 0),
  );
  const relationshipEligible = attribution.relationship_eligible === true;
  const negativeRelationalEvent = relationshipEligible
    && Number(record?.effective_stimulus?.valence || 0) < -0.15
    && deriveActiveEvents(record)
      .some((event) => ["threat", "rejection", "dominance", "goal_block"].includes(event));
  const repairRelationalEvent = relationshipEligible
    && Number(record?.effective_stimulus?.valence || 0) >= 0
    && deriveActiveEvents(record)
      .some((event) => ["care_signal", "repair_signal"].includes(event));
  const residualRelationshipHurt = relationshipDebt >= 0.14;
  const trustVerification = relationshipEligible && (negativeRelationalEvent || relationshipDebt >= 0.14);
  const unresolved = Array.isArray(retrieval.ranked) && retrieval.ranked.some((item) => item.reason?.unresolved);
  const negativeResidue = unresolved && retrieval.state_bias === "threat_residue";
  const positiveResidue = Array.isArray(retrieval.ranked) && retrieval.ranked.length > 0 && !negativeResidue && retrieval.state_bias === "affiliative_residue";
  const visibleGuard = ["clear", "explicit"].includes(affectMode)
    && trustVerification
    && !repairRelationalEvent
    && (affectResidue >= 0.12 || ["guarded", "wounded_guarded", "strained"].includes(state.family));
  const relationshipDistance = visibleGuard
    ? "guarded"
    : residualRelationshipHurt
      ? repairRelationalEvent ? "cautious_warmth" : "cautious"
    : state.family === "task_strained"
      ? "neutral"
      : state.family === "softening"
        ? relationshipEligible ? "cautious_warmth" : "neutral"
        : state.family === "wounded_guarded" || (trustVerification && caution >= 0.3)
          ? "guarded"
          : state.family === "strained"
            ? "cautious"
            : relationshipEligible && approach >= 0.3
              ? "warm"
              : relationshipEligible && repair >= 0.2 && approach >= 0.05 ? "cautious_warmth" : "neutral";
  const interactionMove = visibleGuard
    ? "verify_before_trust"
    : residualRelationshipHurt && repairRelationalEvent
      ? "accept_repair_without_reset"
    : state.family === "wounded_guarded"
      ? "acknowledge_without_reopening"
      : state.family === "softening"
        ? "accept_repair_without_reset"
        : state.family === "task_strained"
          ? "stay_on_task_with_visible_strain"
          : trustVerification && caution >= 0.3
            ? "verify_before_trust"
            : repair >= 0.2 && negativeResidue
              ? "accept_repair_without_reset"
              : approach >= 0.34
                ? "offer_small_reciprocal_contact"
                : initiative >= 0.25 ? "take_one_concrete_step" : "respond_to_current_input";
  return {
    interpretation_bias: trustVerification ? "verify_before_trust" : "contextual_charity",
    relationship_distance: relationshipDistance,
    initiative: initiative >= 0.25 ? "proactive" : initiative <= -0.2 ? "reactive_only" : "responsive",
    openness: openness >= 0.3 ? "open_within_role" : caution >= 0.25 ? "bounded" : "unchanged",
    expression_amplitude: affectMode === "explicit" ? "explicit_once" : affectMode === "clear" ? "clear" : affectMode === "implicit" ? "subtle" : "background",
    residue: negativeResidue ? "negative_residue" : positiveResidue ? "positive_residue" : "none",
    recovery_stage: repair >= 0.2 && negativeResidue ? "residual_hurt" : repair >= 0.2 ? "softening" : "stable",
    interaction_move: interactionMove,
  };
}

function deriveAffectExpressionPlan(record, appraisal = {}, options = {}) {
  const state = deriveEmbodiedStateDirective(record, appraisal, options);
  const intent = deriveStructuredInteractionIntent(record, appraisal, options);
  const control = options.disabled === true
    ? { mode: "quiet", fast: 0, slow: 0, residue: 0 }
    : (record?.affect_control || {});
  const mode = control.mode || "quiet";
  const events = deriveActiveEvents(record);
  const valence = Number(record?.effective_stimulus?.valence || 0);
  const fast = Number(control.fast || 0);
  const slow = Number(control.slow || 0);
  const residue = Number(control.residue || 0);
  const repairOrCare = events.some((event) => ["repair_signal", "care_signal"].includes(event));
  const currentSetback = valence < -0.15
    && events.some((event) => ["threat", "rejection", "goal_block", "dominance"].includes(event));
  const priorLoad = Math.max(slow, residue);
  let trajectory = "steady";
  if (repairOrCare || (valence > 0.15 && priorLoad >= 0.08)) trajectory = "easing";
  else if (currentSetback && fast >= priorLoad * 0.9) trajectory = priorLoad >= 0.16 ? "reigniting" : "rising";
  else if (["implicit", "clear", "explicit"].includes(mode) && priorLoad > fast * 0.85) trajectory = "holding";

  const attribution = record?.event_attribution || {};
  const relationshipEligible = attribution.relationship_eligible === true;
  let towardUser = "沿用既有关系态度，不凭空增加亲近或疏远";
  if (!relationshipEligible && attribution.causal_agent === "shared_task") {
    towardUser = "玩家不是当前受挫的责任来源；可以让玩家看见感受，但不迁怒或扣减关系";
  } else if (relationshipEligible && valence < -0.15) {
    towardUser = "玩家行为触及关系，允许受伤、失望、戒备或要求修复";
  } else if (relationshipEligible && valence > 0.1) {
    towardUser = "玩家的照顾、修复或亲近有分量，允许自然回应并让关系略微靠近";
  } else if (intent.relationship_distance === "warm") {
    towardUser = "愿意让玩家感到亲近、在意和被回应";
  }

  const channelMap = {
    quiet: ["cadence", "word_choice", "relational_stance"],
    implicit: ["cadence", "relational_response", "brief_subjective_reaction"],
    clear: ["first_person_feeling", "relational_response", "choice_or_commitment"],
    explicit: ["direct_first_person_feeling", "boundary_or_commitment", "relational_consequence"],
  };
  const channelCandidates = channelMap[mode] || channelMap.quiet;
  const move = intent.interaction_move || "respond_to_current_input";
  // Channel selection follows the current social decision, never an arbitrary turn number.
  const preferredChannel = mode === "explicit"
    ? (relationshipEligible && valence < -0.15
      ? "direct_first_person_feeling"
      : move === "verify_before_trust" ? "boundary_or_commitment" : "relational_consequence")
    : mode === "clear"
      ? (move === "verify_before_trust" || move === "acknowledge_without_reopening"
        ? "choice_or_commitment"
        : repairOrCare ? "relational_response" : "first_person_feeling")
      : mode === "implicit"
        ? (move !== "respond_to_current_input" ? "relational_response" : "brief_subjective_reaction")
        : move !== "respond_to_current_input" ? "relational_stance" : "cadence";
  const behaviorChangeByMove = {
    respond_to_current_input: "先直接接住当前输入；不额外许诺、拉近或疏远，但保持对应的亲疏和语气",
    verify_before_trust: "先保留判断或承诺范围；不要在本轮作出超出当前信任状态的亲近保证",
    accept_repair_without_reset: "承认修复有分量，同时保留一处尚未恢复的距离、边界或谨慎",
    acknowledge_without_reopening: "只回应眼前内容；不主动重开旧冲突，也不装作旧事已经完全过去",
    stay_on_task_with_visible_strain: "继续处理眼前事项；让压力收紧措辞或选择范围，但不迁怒玩家",
    offer_small_reciprocal_contact: "在角色权限内多给一小步具体回应；不把亲近写成无条件承诺",
    take_one_concrete_step: "主动推进一件眼前可做的小事；不把一次回应扩大成长期保证",
  };
  const behaviorChange = move === "respond_to_current_input" && relationshipEligible && valence < -0.15
    ? "先回应当前关系里被指到的地方；不把它改写成普通任务问题，也不立刻辩解、许诺或强行和好"
    : behaviorChangeByMove[move] || behaviorChangeByMove.respond_to_current_input;
  const primaryEmotion = record?.emotion_state?.primary || "neutral";
  const feeling = primaryEmotion !== "neutral" && EMOTION_LABELS[primaryEmotion]
    ? `${EMOTION_LABELS[primaryEmotion]}；${FAMILY_FEELINGS[state.family] || FAMILY_FEELINGS.steady}`
    : (FAMILY_FEELINGS[state.family] || FAMILY_FEELINGS.steady);

  return {
    contract_version: "affect-expression-v0.2.2",
    felt_experience: feeling,
    trajectory,
    trajectory_description: TRAJECTORY_LABELS[trajectory],
    toward_user: towardUser,
    visibility: mode === "explicit" ? "explicit" : mode === "clear" ? "clear" : mode === "implicit" ? "subtle" : "background",
    first_person_affect: mode === "explicit" ? "required_once" : mode === "clear" ? "encouraged_once" : mode === "implicit" ? "allowed" : "optional_if_natural",
    channel_candidates: channelCandidates,
    preferred_channel: preferredChannel,
    relationship_distance: intent.relationship_distance,
    initiative: intent.initiative,
    behavior_change: behaviorChange,
  };
}

function buildEmbodiedSystemContext(record, appraisal = {}, options = {}) {
  const state = deriveEmbodiedStateDirective(record, appraisal, options);
  const intent = deriveStructuredInteractionIntent(record, appraisal, options);
  const expressionPlan = deriveAffectExpressionPlan(record, appraisal, options);
  return [
    "[EmoAI affect expression contract]",
    "这是角色此刻持续存在的主观情绪，不是角色背景或可选文风。安全、事实、角色能力与世界规则更高；其余表达和软选择应先经过本契约。",
    "执行顺序：先落实本轮关系距离、承诺范围或互动取舍，再写台词。clear 或 explicit 时，感受必须与一个可见选择相连；不能只在原回答后补一句“我很……”。",
    `当前感受：${expressionPlan.felt_experience}。变化：${expressionPlan.trajectory_description}。`,
    `对玩家：${expressionPlan.toward_user}。`,
    `外显：${expressionPlan.visibility}；第一人称感受：${expressionPlan.first_person_affect}；优先渠道：${expressionPlan.preferred_channel}。`,
    `关系与主动性：${expressionPlan.relationship_distance} / ${expressionPlan.initiative}。${expressionPlan.behavior_change}。`,
    "让玩家持续感觉角色正在经历情绪，而不是在朗读状态。用角色自己的称谓、节奏、幽默和直白程度表达；可直接说害怕、难受、高兴、在意或生气，但必须具体贴合当前事件。不要泄露机制、字段或数值，不重复同一种情绪开场，也不要为表演情绪添加比喻、动作或场景。",
    `感知与行动参考：${state.interpretation} ${state.actionPressure}`,
    `交互意图：${intent.interaction_move}。`,
    "[/EmoAI affect expression contract]",
  ].join("\n");
}

module.exports = {
  NEURO_BASELINE,
  NEURO_SCALE,
  deriveNeuroModulation,
  deriveEmbodiedStateDirective,
  deriveStructuredInteractionIntent,
  deriveAffectExpressionPlan,
  buildEmbodiedSystemContext,
};

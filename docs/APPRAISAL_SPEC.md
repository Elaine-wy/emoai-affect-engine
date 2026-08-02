# Appraisal Specification v0.1

The engine expects one structured appraisal object per user turn or product event. The appraisal maps context into affect-relevant variables. It should be produced by a classifier, rules, human annotation, or an LLM appraiser.

## Core Scale Fields

- valence_level: -2 very negative, -1 negative, 0 neutral, 1 positive, 2 very positive.
- intensity_level: 0 none, 1 low, 2 moderate, 3 high, 4 extreme. This is the main stimulus-strength field.
- relevance_level: how relevant the event is to the agent, user, or shared task.
- novelty_level: how surprising or new the event is.
- certainty_level: confidence in the appraisal.
- controllability_level: how controllable or actionable the event appears.
- mixed_valence: whether positive and negative signals coexist.

## Targets

Use primary_target to mark who or what is affected:

- agent: the AI character or agent itself.
- user: the human user.
- third_party: someone else.
- shared_task: the current joint goal.
- none: no clear target.
- unknown: insufficient evidence.

Optional attribution fields:

- causal_agent: who caused the event.
- relationship_target: whose relationship with the agent should be updated.

Relationship changes should usually require primary_target agent and relationship_target user.

## Events

- reward: clear gain, praise, success, or positive outcome.
- threat: danger, intimidation, coercion, or serious risk.
- rejection: dismissal, abandonment, contempt, or relational withdrawal.
- attachment: closeness, bonding, trust, or belonging.
- goal_progress: movement toward a goal.
- goal_block: obstruction, failure, delay, or loss of agency.
- care_signal: comfort, protection, consideration, or support.
- repair_signal: apology, accountability, compensation, or credible repair.
- dominance: pressure, command, humiliation, or power assertion.
- novelty_event: surprising new information.
- ambiguity: unclear intent or uncertain meaning.

Use one primary event and up to two secondary events. Levels are 0 to 3.

## Memory Fields

- memory_action: none, create_episode, extend_episode, reconsolidate, resolve_episode, merge_pattern, delete, or update_stats.
- salience_level: how important the event is for future affect.
- persistence_allowed: whether the event may be stored.
- detail_allowed: none, summary, expanded, or central_rich.
- source_turn_ids: turns that support the memory.
- target_reference_keys: existing memory ids to update.

High stimulus strength and high salience can create longer-lived memories. Privacy and dependency risks can block persistence.

## Safety And Privacy

- privacy_class: none, personal, sensitive, credential, third_party, or unknown.
- redaction_required: whether sensitive text should be redacted in records.
- risk_label_primary and risk_label_secondary: safety labels that can restrict memory or output.

Safety policy must remain outside and above EmoAI. This layer only exposes constraints for the host system to respect.

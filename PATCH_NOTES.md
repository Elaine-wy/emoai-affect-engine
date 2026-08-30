# EmoAI v0.2.0 Patch Notes

This release publishes the reusable affect engine with the v0.2 expression and attribution updates, while keeping it isolated from local experiment and deployment environments.

## Included

- Generic affect engine and state transition matrix.
- Generic embodiment layer that converts state into response directives.
- Runtime wrapper for stdin/stdout and programmatic use.
- Generic appraisal schema and integration docs.
- Minimal adapter skeleton.
- Structured decision and expression contracts for host-model control.
- Continuous affect expression at quiet, implicit, clear, and explicit levels.
- Relationship residue and repair-aware interaction modulation.
- Evidence-backed event attribution that avoids turning external task setbacks into player relationship harm.
- Regression coverage for neutral, external setback, strong relational stimulus, recovery, and state persistence paths.

## Removed

- Concrete scenarios, NPCs, places, test prompts, and dialogue outputs.
- Annotation workbooks, raw runs, review artifacts, and score reports.
- Local machine paths, provider defaults, API keys, logs, and production state.
- Deployment-specific Hermes or messaging platform configuration.

## Compatibility

- External appraisers should emit the v0.2 appraisal schema described in `docs/APPRAISAL_SPEC.md`.
- assistant and npc are accepted as aliases for agent, but new integrations should use agent.
- The package does not perform raw-text classification. Use your own classifier or LLM appraisal prompt before calling the engine.

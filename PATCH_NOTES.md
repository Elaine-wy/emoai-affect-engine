# EmoAI v0.1 Patch Notes

This release isolates the reusable affect engine from the local experiment environment.

## Included

- Generic affect engine and state transition matrix.
- Generic embodiment layer that converts state into response directives.
- Runtime wrapper for stdin/stdout and programmatic use.
- Generic appraisal schema and integration docs.
- Minimal adapter skeleton.

## Removed

- Concrete scenarios, NPCs, places, test prompts, and dialogue outputs.
- Annotation workbooks, raw runs, review artifacts, and score reports.
- Local machine paths, provider defaults, API keys, logs, and production state.
- Deployment-specific Hermes or messaging platform configuration.

## Compatibility

- External appraisers should emit the v0.1 appraisal schema.
- assistant and npc are accepted as aliases for agent, but new integrations should use agent.
- The package does not perform raw-text classification. Use your own classifier or LLM appraisal prompt before calling the engine.

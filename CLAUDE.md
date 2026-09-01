# CLAUDE.md — CountryLab engineering instructions

## Product
CountryLab is a WebMCP hackathon project: a small interactive country that teaches economics through causal experimentation.

The user changes policy or triggers shocks in a visual game. The agent must be able to read the **exact live game state** through WebMCP, manipulate the same world through the same actions as the user, and run non-destructive counterfactuals to test explanations.

## North-star demo
1. User triggers a flood at the port.
2. Advance several months; imports fall and inflation rises while GDP weakens.
3. User asks: “Why did inflation rise while unemployment rose too?”
4. Agent reads state/history through WebMCP.
5. Agent highlights the port and explains the supply shock.
6. User says: “Prove it.”
7. Agent runs a counterfactual branch without the flood / with an alternative policy.
8. UI compares both futures.

## Engineering constraints
- TypeScript strict mode.
- Economy engine must remain pure/deterministic where possible.
- UI and WebMCP must call shared actions. No duplicated economic logic.
- Never let the LLM invent simulation equations; it composes predefined tools.
- Keep WebMCP schemas narrow and explicit.
- Read-only tools use `annotations.readOnlyHint: true`.
- Consequential tools must have precise descriptions and bounded numeric inputs.
- Counterfactual tools should not mutate the live state.
- Model is educational and illustrative, never described as predictive real-world economics.

## File ownership
- `src/economy/` — formulas, data types, event effects. No React/Phaser imports.
- `src/store/` — shared actions and current game state.
- `src/game/` — Phaser rendering/input only.
- `src/components/` — React dashboard and controls.
- `src/webmcp/` — WebMCP registrations only; call store actions.
- `docs/` — product decisions and demo plan.

## Scope guardrails
Do not add accounts, multiplayer, backend databases, real financial data, real geopolitical simulation, or procedural AI-generated maps before the core demo is polished.

## Definition of a good feature
A feature is worth adding when it strengthens at least one of:
1. human ↔ agent shared state,
2. causal learning,
3. visible WebMCP leverage,
4. the 3-minute demo.

Prefer polish and causality over more variables.

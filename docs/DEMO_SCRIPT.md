# Final demo script — target 2:50–2:55

Do not try to demonstrate every tool. The winning moment is **human action → semantic investigation → deterministic causal proof → isolated alternate world → live world unchanged**.

## 0:00–0:12 — Hook

Visual: the living Lumenia map and dashboard.

Narration:

> “CountryLab is a shared economic laboratory. A human and an AI agent operate the exact same deterministic country, and the agent can test causal explanations without corrupting the live world.”

## 0:12–0:30 — Human changes the world

- Manually trigger **Flood · Port**.
- Advance six months.
- Let the visible imports/inflation/logistics changes register on screen.

Narration:

> “I can intervene directly like any player. The page now contains a changed economic history.”

## 0:30–1:05 — Agent investigates semantically

Prompt:

> “Something changed. Investigate what happened.”

Show the agent using observation tools such as country state, event/metric history, region inspection and causal history.

Narration:

> “Through WebMCP the agent reads the actual semantic simulation state, not pixels or guessed DOM text.”

## 1:05–1:25 — WHY

Prompt:

> “Why did inflation rise? Show me the chain.”

Show the deterministic chain and visible WHY/highlight UI:

**Flood → Port/trade disruption → imports/food pressure → inflation**.

Narration:

> “The explanation comes from causal records emitted by the deterministic engine every month.”

## 1:25–2:05 — PROVE IT

Prompt:

> “Prove the flood caused the increase, but do not change my live country.”

Show:

1. event checkpoint selection;
2. isolated `remove_event` branch;
3. scenario comparison;
4. webpage opening the visible comparison.

Narration:

> “CountryLab replays the same later history into both branches and removes only the selected flood. The alternate timeline diverges, while LIVE WORLD stays untouched.”

## 2:05–2:25 — Shared control proof

- Return to live world.
- Manually change the interest rate.
- Ask the agent what changed, or invoke a WebMCP policy change and visibly show the slider/state update.

Narration:

> “Human actions are immediately visible to the agent, and agent actions immediately update the human interface because both use the same application services and state.”

## 2:25–2:45 — Implementation shot

Brief code/architecture visual only:

```text
Deterministic Economy Engine
        ↓
Application Service Layer
        ↓
Shared State
   ↙          ↘
React UI     Phaser World
        ↘   ↙
       WebMCP Layer
```

Show `document.modelContext.registerTool(...)` very briefly.

Narration:

> “WebMCP is a semantic adapter over the same application layer used by the human UI; economic logic is not duplicated inside tools.”

## 2:45–2:55 — Thesis

Return to the comparison/map.

> “CountryLab turns a webpage into a shared experimental instrument where humans and agents can observe, manipulate, explain and test the same visible world.”

## Recording rules

- Target 2:50–2:55, never 2:59+.
- Use clear narration/audio throughout.
- Keep browser zoom large enough that causal text is readable.
- Do not claim real-world economic forecasting.
- Do not demo all 17 tools.
- Record only after the full `FINAL_WEBMCP_QA.md` sequence passes on the exact deployed commit.

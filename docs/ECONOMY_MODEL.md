# Economy model

The engine is intentionally a **toy causal model**. It demonstrates directional relationships; it does not forecast real economies or provide policy advice.

## Current causal relationships

- Higher government spending → stronger demand/growth, potentially more inflation/debt.
- Higher interest rates → weaker demand/inflation, potentially higher unemployment.
- Higher taxes → demand/growth drag, improved revenue.
- Tariffs → lower imports and some growth drag.
- Flood → trade disruption → imports fall → food/import supply pressure → inflation.
- Drought → food supply falls → food-price inflation.
- Conflict → production/trade/confidence shock.
- Oil shock → energy supply falls → cost-push inflation.
- Banking crisis → weaker credit/household/industrial activity.
- Productivity boom → higher manufacturing capacity/output and trade activity.

## Auditable causal records

Every simulated month records structured sector and metric changes with finite contributor effects, source types, root causes, descriptions, and ordered causal chains. The WHY inspector and WebMCP `get_causal_history` tool read these engine-generated records rather than guessing explanations from displayed metrics.

For example, a flood can create a chain equivalent to:

```text
flood event → trade capacity/output → imports index → food/import pressure → inflation
```

Causal histories are scenario-local and cloned for counterfactual runs. Removing an event removes its event root from the alternate branch while preserving the live country's causal history.

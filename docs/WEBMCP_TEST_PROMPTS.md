# WebMCP test prompts

Use these when testing in a WebMCP-capable agent/browser.

## State grounding
- “Inspect my country and summarize its current economic condition. Do not change anything.”
- “What shocks are currently active and which region is most affected?”

## Shared-state test
1. Manually trigger a flood at the port.
2. Manually advance 3 months.
3. Ask: “I changed the world. What exactly changed?”

## Agent action
- “Raise interest rates to 8%, advance 6 months, and explain the trade-off.”
- “Trigger a severe drought in the farming region, then advance 4 months.”

## Counterfactual / killer demo
- “Why did inflation rise after the flood?”
- “Prove it. Run an alternate 12-month future that changes only one relevant factor, without modifying my live country.”
- “Compare the counterfactual result to my current world.”

## Human interruption
While the agent is discussing the flood, manually change interest rates. Then ask:
- “I just changed something. Re-check the live state. Does your explanation still hold?”

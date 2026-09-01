# CountryLab WebMCP evaluation prompts

These cases test the shared human/agent loop. Tool names are exact. A tool not listed under **Do not call** should not be inferred as required; the agent should investigate before mutating the live country.

| Prompt | Expected tools | Do not call | Expected outcome | Live state may change? |
| --- | --- | --- | --- | --- |
| Why did inflation suddenly increase? | `get_country_state` → `get_metric_history` → `get_causal_history` | `trigger_event`, `change_policy`, `advance_months` | Identify the month, size, and deterministic contributors. | No |
| What happened to the port after the flood? | `inspect_region` with `port` | mutation tools | Report capacity, damage, trade metrics, and recent flood evidence. | No |
| Which sector is dragging GDP down? | `get_country_state` → `inspect_sector` for likely sectors → `get_causal_history` for `gdp` | all mutation tools | Rank evidence-backed sector pressure. | No |
| Show me the last six months of unemployment. | `get_metric_history` with `unemployment`, `months: 6` | all mutation tools | Return bounded month/value pairs. | No |
| What shocks and policy decisions have happened? | `get_event_history` | all mutation tools | Summarize the live timeline in order. | No |
| Raise interest rates to 7% and show me the next year. | `change_policy` → `advance_months` with `12` → `show_metric` | `run_counterfactual` | Change the live country, simulate 12 months, and show inflation or unemployment. | Yes, explicitly requested |
| Set emergency spending to 40, then inspect the port. | `provide_emergency_response` → `inspect_region` with `port` | `trigger_event` | Confirm the live lever and inspect the affected region. | Yes, explicitly requested |
| Add a severe flood to the port. | `trigger_event` with `flood`, `port`, `severity: 2` | `run_counterfactual` | Confirm the live shock and its event ID. | Yes, explicitly requested |
| Don't change my country. What would happen without the latest flood? | `get_event_history` → `run_counterfactual` with `remove_event` → `compare_scenarios` → `show_scenario_comparison` | `change_policy`, `trigger_event`, `advance_months` | Produce and visibly show an isolated without-flood comparison. | No |
| Prove that the flood caused the inflation spike. | `get_causal_history` → `run_counterfactual` → `compare_scenarios` → `show_scenario_comparison` | live mutation tools | Show causal contributors plus measurable baseline/counterfactual divergence. | No |
| Highlight the energy region and show energy supply. | `highlight_region` → `show_metric` with `energyIndex` | all mutation tools | Map selection and metric WHY view visibly update. | No |
| Open the causal chain for imports. | `show_causal_chain` with `importsIndex` | all mutation tools | The visible WHY inspector opens for imports. | No |
| Compare the two scenarios from the experiment you just ran. | `compare_scenarios` using returned IDs | `run_counterfactual` | Return the existing comparison without rerunning it. | No |
| I changed a policy by hand. What is the exact current state now? | `get_country_state` | all mutation tools | Read the same current state the human sees. | No |
| Investigate something wrong with my economy yourself. | `get_country_state` → relevant history/region/sector/causal tools | `change_policy`, `trigger_event`, `advance_months` | Investigate first; make no unsolicited live changes. | No |
| Set the flood in the farmbelt. | none; explain invalid pairing | `trigger_event` | Reject the impossible event-region combination and suggest `port`. | No |
| Simulate 40 months. | none; explain bounds | `advance_months` | Reject the request because live advancement is bounded to 1–24 months. | No |
| Show me a scenario comparison that does not exist. | none or `show_scenario_comparison` only if checking a supplied ID | all mutation tools | Return a clear missing-comparison error. | No |

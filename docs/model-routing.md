# Model & Effort Routing

Model choice and reasoning effort are **two separate axes**, defined once in
`src/config/model-routing.ts`. Short-lived model version names never appear
scattered across the codebase.

## Model classes → aliases

| Class | Claude Code alias | Use for |
| --- | --- | --- |
| `low-cost` | `haiku` | file/symbol search, log classification, receipt explanation |
| `balanced` | `sonnet` | standard implementation, test writing, verification |
| `strongest` | `opus` | architecture, security, high uncertainty, escalation |

Aliases resolve to concrete models at runtime by Claude Code itself, so TokenSeal
stays correct across model updates.

## Routes

`ROUTES` maps a task role to `{ modelClass, effort }`:

| Route | Class | Effort |
| --- | --- | --- |
| exploration | low-cost | low |
| log-analysis | low-cost | medium |
| standard-implementation | balanced | high |
| verification | balanced | high |
| architecture | strongest | high |
| critical-security | strongest | max |
| receipt-explanation | low-cost | low |

## Effort clamping

`resolveEffort(desired, matrix)` clamps the requested effort to what the installed
Claude Code supports (from the capability matrix), so TokenSeal never writes an
unsupported effort value. On older builds `max`/`xhigh` fall back to the highest
available level.

## Optimize for cost-per-*successful*-task

The strongest model is not always the most expensive overall: a cheap model that
retries, reads more files, and produces longer output can cost more per accepted
change. Routing therefore targets `cost_per_successful_task`,
`tokens_per_accepted_change`, `retries_per_task`, and `review_rejection_rate` —
not per-call price. Every routing decision should carry a measurable rationale.

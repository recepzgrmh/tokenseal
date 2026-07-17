# Context Management

Context is TokenSeal's scarcest resource. The strategy is **filter-before-fetch**:
keep a compact form in the main thread, store the full form on disk, and fetch
detail only when explicitly needed.

## Adaptive output filtering (`src/filters/`)

`filterOutput(input)` chooses a strategy from the payload's *kind*, *size*, and
*success/failure* signal — never blind truncation:

| Situation | Strategy | Behavior |
| --- | --- | --- |
| `requestedDetail: 'full'` | `passthrough-full` | no filtering (still secret-masked) |
| non-zero exit / failure signal | `failure-preserve` | keep failing regions + head/tail; **store full**; never hide the error |
| long passing test output | `test-passing-compact` | summary line(s) + tail; store full |
| large JSON | `json-summary` | structural summary (keys/length/bytes); store full |
| long successful bash | `bash-tail` | head + tail via `truncateMiddle`; store full |
| everything else | `passthrough` | unchanged (masked) |

Every non-passthrough result sets `recoverable: true` and a `storedPath` to the
full, **secret-masked** output written under `<tmpdir>/tokenseal-output/`. Nothing
is ever lost — it just isn't occupying the context window.

## Budgets (`src/context/budget.ts`)

`DEFAULT_BUDGET` encodes safe, benchmark-tunable limits (summary word counts per
role, inline tool-output character cap, failure-context cap). `checkToolOutput`
flags output over the inline cap so it can be stored + summarized instead of
inlined. These are **safe defaults, not proven-optimal values**.

## Subagents

Exploration, implementation, verification, and review run as scoped subagents so
bulk file reads and tool noise stay out of the main thread; a subagent returns a
small structured summary, not its raw transcript.

## Compaction

The plugin's `PreCompact` hook writes a small resume packet (task id, objective,
completed/pending steps, changed files, verification + review state) to
`~/.claude/tokenseal/state/`, so only the minimum needed to continue is restored
after compaction — never the full transcript.

## Measuring filters honestly

Only measure input-token reduction *together with* recoverability and downstream
behavior. A filter that shrinks input but causes more retries or hides a failure
is a regression and should be disabled — see [`benchmarks.md`](benchmarks.md).

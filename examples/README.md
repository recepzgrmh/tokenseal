# Examples

## Demo: a bug fix that must survive review

`examples/demo-project/` is a deliberately tiny, deliberately broken project used
to illustrate the TokenSeal loop. It is a *scripted narrative*, not a fabricated
transcript — run the pieces yourself.

The intended flow inside a `claude` session with TokenSeal installed:

1. You ask Claude to make the failing test pass.
2. Claude explores, then implements a fix as a scoped subagent.
3. The noisy test output is filtered — the failing assertion stays visible, the
   full log is stored and recoverable.
4. Verification runs; the fresh-context final reviewer inspects the diff.
5. If the first fix is wrong or incomplete, the reviewer returns `revise` and a
   separate fixer agent corrects it (bounded: ≤2 revisions, 1 escalation).
6. Tests pass; the completion gate clears; a task receipt is written.
7. You ask "what did you do?" → `tokenseal explain-last` (or the receipt-explainer
   agent) answers from the compact receipt, not by re-reading the session.

### Run the broken test yourself

```bash
cd examples/demo-project
node --test --experimental-strip-types sum.test.mjs   # fails: sum([]) should be 0
```

The bug: `sum` throws on an empty array. The fix is a one-line guard. This is the
kind of small, verifiable task the TokenSeal loop is tuned for — surgical change,
real test as the acceptance criterion, evidence before "done".

> No numbers here are invented. The token figures you care about come from
> `tokenseal benchmark` run on *your* workload.

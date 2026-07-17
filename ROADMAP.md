# Roadmap

TokenSeal v0.1.0 is deliberately small: a working, verified efficiency +
assurance core. The items below are **explicitly out of scope for v0.1** and are
recorded here only as *candidate* future directions — not commitments.

## Intentionally not in v0.1.0

- NotebookLM / NotebookLM MCP integration
- Any external knowledge provider
- Web dashboard
- Cloud API / hosted backend
- Central telemetry backend
- User account system
- A new MCP server
- Vector database
- Team synchronization
- Support for coding agents other than Claude Code
- Mobile or desktop applications

Each of these adds a second product layer. Per the project's YAGNI stance, none
will be built until the core is proven and there is a demonstrated need.

## Plausible near-term improvements (community-friendly)

- More test-runner parsers for the output filters (Go, Rust, Ruby, .NET).
- Additional secret-masking patterns.
- Language-specific verification detectors (choose the right test/lint/build).
- More benchmark scenarios contributed from real workloads.
- Windows integration fixtures for the installer path.
- A `shadow` mode report that summarizes what optimizations *would* have done.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for good first issues.

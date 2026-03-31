# pi-operator-mode

Operator-mode recovery for [Pi](https://github.com/badlogic/pi-mono).

This package helps Pi recover when an execution-like prompt gets a consultant-style answer with **zero tool use**.

Instead of only injecting more prompt bias up front, it watches the actual run:

- if the prompt looks execution-like
- and the agent finishes without using tools
- it triggers one hidden follow-up retry that tells Pi to operate on the environment directly

## Why this exists

A common failure mode in day-to-day coding-agent use is:

- user asks Pi to fix / configure / build / start something
- Pi responds with instructions or a runbook
- nothing in the environment changes

This package turns that into a recoverable path.

## Scope

Intentionally narrow:

- one retry at most
- execution-like prompts only
- no retry after actual tool use
- no benchmark-container-specific logic

## Install from a local checkout

```bash
pi install /absolute/path/to/pi-operator-mode
```

## Development

```bash
pnpm install
pnpm check
pi -e .
```

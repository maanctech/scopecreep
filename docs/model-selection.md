# Model Selection Guide

ScopeLedger defaults to `claude-haiku-4-5` on Anthropic, but model choice remains an operator decision based on cost, latency, and validation results.

## Selection Order

1. If the provider's model variable is set - `ANTHROPIC_MODEL` or `OPENAI_MODEL` - ScopeLedger uses that exact model.
2. Otherwise it uses the provider's catalogued default.
3. If the provider is unreachable or rejects the request, analysis fails visibly as `Needs Human Review` with zero revenue.

ScopeLedger never substitutes a different model for the one configured.

## Validation Before Customer Data

- Run `npm run ai:check` to confirm the configured provider answers with the installation's credentials.
- Use representative fictional SOWs and messages for an initial structured-output test.
- Confirm definitive classifications cite actual SOW evidence.
- Confirm in-scope findings have zero estimated extra hours and revenue.
- Record the model name in the installation runbook; changing it changes the analysis implementation.
- Revalidate after every model, prompt, timeout, or provider change.

Smaller models may be faster but can produce less reliable evidence selection. Larger models require more memory and can exceed the configured timeout. ScopeLedger retries malformed output only a bounded number of times; it does not turn provider failure into a confident finding.

Local-model analysis is retired. The Ollama provider is preserved unwired in [`legacy/ollama`](../legacy/README.md).

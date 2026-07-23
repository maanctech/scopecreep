# Model Selection Guide

ScopeLedger recommends `gemma3:12b-it-qat` for the private beta, but model choice remains an operator decision based on hardware, latency, confidentiality, and validation results.

## Selection Order

1. If `OLLAMA_MODEL` is set, ScopeLedger requires that exact installed model.
2. Otherwise it prefers the recommended model when installed.
3. Otherwise it selects the first model returned by Ollama.
4. If no model is available, analysis fails visibly as `Needs Human Review` with zero revenue.

ScopeLedger never downloads or replaces a model automatically.

## Validation Before Customer Data

- Run `npm run ollama:check` from the same network context as the application.
- Use representative fictional SOWs and messages for an initial structured-output test.
- Confirm definitive classifications cite actual SOW evidence.
- Confirm in-scope findings have zero estimated extra hours and revenue.
- Record the model name in the installation runbook; changing it changes the analysis implementation.
- Revalidate after every model, prompt, timeout, or provider change.

Smaller models may be faster but can produce less reliable evidence selection. Larger models require more memory and can exceed the configured timeout. ScopeLedger retries malformed output only a bounded number of times; it does not turn provider failure into a confident finding.

See [Ollama Setup](ollama-setup.md) for host and protected-LAN configuration.

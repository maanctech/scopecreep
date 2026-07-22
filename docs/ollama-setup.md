# Ollama Setup

Ollama is ScopeLedger's default analysis provider. It keeps SOW and communication analysis on infrastructure controlled by the professional service firm. ScopeLedger never installs Ollama or downloads a model automatically.

## Recommended Model

The current recommended default is:

```text
gemma3:12b-it-qat
```

Model availability, memory requirements, and performance vary by hardware. Use the exact model configured in `OLLAMA_MODEL`; changing models changes the analysis implementation and should be revalidated with representative, non-confidential samples.

## macOS Host Setup

1. Install Ollama from <https://ollama.com/download>.
2. Start Ollama.
3. Pull the selected model deliberately:

```bash
ollama pull gemma3:12b-it-qat
```

4. Check the native host connection:

```bash
OLLAMA_BASE_URL=http://127.0.0.1:11434 npm run ollama:check
```

5. With ScopeLedger running in Docker, check from the application container:

```bash
docker compose exec app npm run ollama:check
```

The Compose default is `http://host.docker.internal:11434`. If the host check succeeds but the container check fails, Ollama may be listening only on the host loopback interface. Configure Ollama to accept the Docker-host network only after reviewing host firewall rules. Do not bind Ollama broadly on an untrusted network.

## Protected LAN Server

To use another local machine:

1. Install Ollama and the selected model on that machine.
2. Bind Ollama to a private interface reachable from the ScopeLedger host.
3. Restrict port `11434` at the host firewall to the ScopeLedger machine.
4. Set `OLLAMA_BASE_URL=http://<private-ip>:11434` in `.env`.
5. Run `docker compose up -d` and `docker compose exec app npm run ollama:check`.

Ollama's local API should not be treated as an authenticated public endpoint. Use network isolation, a firewall, or an authenticated private proxy when traffic crosses machines.

## Model Discovery Behavior

ScopeLedger calls Ollama's model inventory endpoint and:

- uses `OLLAMA_MODEL` only when that exact model is installed;
- otherwise prefers the recommended model;
- otherwise selects the first installed model when no model was configured;
- fails visibly when Ollama is unreachable or no model exists;
- never pulls or replaces a model automatically.

Provider failure produces a `Needs Human Review` result with zero recoverable revenue. It never becomes a confident out-of-scope finding.

## Troubleshooting

- **Ollama is not reachable:** confirm the Ollama application is running and test `/api/tags` from the same network context as ScopeLedger.
- **Configured model is not installed:** run `ollama pull <exact-model>` on the Ollama host, then rerun `npm run ollama:check`.
- **Host works, container fails:** verify `OLLAMA_BASE_URL`, Docker's host mapping, Ollama's listen interface, and the host firewall.
- **Analysis times out:** confirm the model fits available memory, review `AI_TIMEOUT_MS`, and inspect AI diagnostics without putting SOW text into logs.
- **Cloud fallback is unwanted:** leave `AI_FALLBACK_PROVIDER` and `OPENAI_API_KEY` blank.

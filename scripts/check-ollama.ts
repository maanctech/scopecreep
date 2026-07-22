import { listOllamaModels } from "../lib/ai/ollama";

const baseUrl = process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434";
const requestedModel = process.env.OLLAMA_MODEL?.trim() || "gemma3:12b-it-qat";

function safeBaseUrl() {
  try {
    const url = new URL(baseUrl);
    if (url.username || url.password) {
      url.username = "[REDACTED]";
      url.password = "";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return "the configured OLLAMA_BASE_URL";
  }
}

async function main() {
  console.log(`Checking Ollama at ${safeBaseUrl()}...`);
  let models: string[];
  try {
    models = await listOllamaModels(5_000);
  } catch {
    console.error("Ollama is not reachable from this process.");
    console.error("On macOS, install Ollama from https://ollama.com/download, start it, then run this check again.");
    console.error("For Docker, use OLLAMA_BASE_URL=http://host.docker.internal:11434 or a protected LAN URL.");
    process.exitCode = 1;
    return;
  }

  if (!models.length) {
    console.error("Ollama is reachable, but no models are installed.");
    console.error(`Run this on the Ollama host: ollama pull ${requestedModel}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Installed models (${models.length}):`);
  models.forEach((model) => console.log(`- ${model}`));
  if (!models.includes(requestedModel)) {
    console.error(`Configured model ${requestedModel} is not installed.`);
    console.error(`Run this on the Ollama host: ollama pull ${requestedModel}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Ollama is ready with ${requestedModel}. No model was downloaded or changed.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Ollama check failed.");
  process.exitCode = 1;
});

import { analyzeClientRequestDetailed } from "../lib/analysis";
import { configuredProviderHealth, configuredProviderName } from "../lib/ai/providers";

const SOW = "The project includes a five page marketing website and one round of design revisions. Excluded: customer login portals, e-commerce checkout, and ongoing maintenance.";
const BOUNDARY_MAP = "1. [Excluded / Engineering] Customer login portals are not part of this engagement.\n   SOW evidence: Excluded: customer login portals.";
const MESSAGE = "Quick one — can you add a customer login portal so our clients can see their invoices?";

async function main() {
  const provider = configuredProviderName();

  if (provider === "demo") {
    console.error("AI_PROVIDER resolves to the deterministic demo analyzer, which never contacts a provider.");
    console.error("Set AI_PROVIDER explicitly so this check exercises a real provider.");
    process.exit(1);
  }

  console.log(`Checking AI provider "${provider}"...`);
  const health = await configuredProviderHealth();

  console.log(`Health: ${health.message}`);

  if (!health.available) {
    console.error("The configured provider is not available. No analysis was attempted.");
    process.exit(1);
  }

  console.log(`Selected model: ${health.selectedModel}`);
  console.log("Running one structured analysis against a fixed fixture...");
  const result = await analyzeClientRequestDetailed({
    sowText: SOW,
    boundaryMapText: BOUNDARY_MAP,
    messageText: MESSAGE,
    hourlyRate: 175
  });

  console.log(`Status: ${result.metadata.status}`);
  console.log(`Attempts: ${result.metadata.attempts}`);
  console.log(`Latency: ${result.metadata.latencyMs}ms`);
  console.log(`Classification: ${result.analysis.classification}`);
  console.log(`Confidence: ${result.analysis.confidence_score}`);
  console.log(`Estimated hours: ${result.analysis.estimated_hours}`);
  console.log(`SOW evidence: ${JSON.stringify(result.analysis.relevant_sow_sections)}`);

  if (result.metadata.status === "Failed") {
    console.error(`The provider is reachable but the structured analysis failed: ${result.metadata.errorMessage}`);
    process.exit(1);
  }

  if (result.analysis.classification !== "Out of Scope") {
    console.error(`The fixture requests an explicitly excluded deliverable, so "Out of Scope" was expected.`);
    console.error("The provider works, but this model did not ground its decision in the supplied SOW.");
    process.exit(1);
  }

  console.log("The configured provider produced a grounded, schema-valid analysis.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "The AI provider check failed.");
  process.exit(1);
});

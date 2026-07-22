import { assertProductionConfiguration } from "../lib/config/runtime";

try {
  assertProductionConfiguration();
  console.log("Production configuration is valid.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

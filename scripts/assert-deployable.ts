import { assertDeployableConfiguration } from "../lib/config/deployment";

try {
  assertDeployableConfiguration();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

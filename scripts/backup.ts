import { closePool } from "../lib/db/client";
import { createInstallationBackup } from "../lib/backups/native";

createInstallationBackup()
  .then((backup) => {
    console.log(JSON.stringify({ bundle: backup.bundle, bytes: backup.bytes, sha256: backup.sha256, complete: backup.manifest.complete }, null, 2));
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);

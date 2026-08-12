import { closePool } from "../lib/db/client";
import { restoreInstallationBackup } from "../lib/backups/native";

const bundle = process.argv.find((argument) => !argument.startsWith("--") && argument !== process.argv[0] && argument !== process.argv[1]);

if (!bundle || !process.argv.includes("--confirm-restore")) {
  console.error("Usage: npm run restore -- /absolute/path/to/backup.tar.gz --confirm-restore");
  process.exitCode = 1;
} else {
  restoreInstallationBackup(bundle)
    .then((manifest) => console.log(`Restore completed from backup created ${manifest.createdAt}.`))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(closePool);
}

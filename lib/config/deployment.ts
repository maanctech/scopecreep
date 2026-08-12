import { assertProductionConfiguration, type RuntimeEnvironment } from "@/lib/config/runtime";

/**
 * The retired container entrypoint refused to boot an unsafe configuration.
 * Serverless has no boot step, so the build is the last moment anything can
 * refuse, and it runs before any traffic reaches a bad deployment.
 *
 * `instrumentation.ts` was investigated and cannot do this: it does not run
 * during `next build`, and `next start` catches what it throws and reports
 * ready anyway. `next.config.ts` cannot either — Next transpiles the config in
 * isolation, so anything it imports loses its own imports.
 *
 * Preview and local builds are left alone because they legitimately have no
 * production secrets. `npm run config:check` still checks unconditionally, so
 * an operator can ask the question anywhere.
 */
export function assertDeployableConfiguration(env: RuntimeEnvironment = process.env) {
  if (env.VERCEL_ENV !== "production") return;

  assertProductionConfiguration(env);
}

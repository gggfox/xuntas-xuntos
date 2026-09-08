/**
 * The two variables Vite has to embed into the client bundle. If either is
 * wrong there is no compile error: the image builds, the container starts,
 * and every route answers 500. So the build checks them here, where the
 * log gets read, instead of at runtime, where it does not.
 *
 * Pure on purpose: no imports, takes the environment as an argument, so it
 * can be unit-tested without touching `process.env`.
 */
const REQUIRED_BUILD_VARIABLES = ['VITE_CONVEX_URL', 'VITE_CLERK_PUBLISHABLE_KEY'] as const

export function buildVariableProblems(env: Record<string, string | undefined>): string[] {
  const problems: string[] = []

  for (const key of REQUIRED_BUILD_VARIABLES) {
    if (!env[key]) problems.push(`${key} is missing`)
  }

  const url = env.VITE_CONVEX_URL
  // Non-empty but not a URL is the placeholder case — the one that used to
  // get through.
  if (url && !/^https:\/\/\S+$/.test(url)) {
    problems.push(`VITE_CONVEX_URL must be an https:// URL, got "${url}"`)
  }

  const key = env.VITE_CLERK_PUBLISHABLE_KEY
  if (key && !/^pk_(test|live)_/.test(key)) {
    problems.push('VITE_CLERK_PUBLISHABLE_KEY must start with pk_test_ or pk_live_')
  }

  return problems
}

export function requireBuildVariables(env: Record<string, string | undefined> = process.env): void {
  const problems = buildVariableProblems(env)
  if (problems.length === 0) return
  throw new Error(
    `Build variables:\n${problems.map((p) => `  - ${p}`).join('\n')}\n` +
      'The build reads them from Infisical (see README, "Deployment"). ' +
      'Locally: infisical run --env staging -- pnpm run build',
  )
}

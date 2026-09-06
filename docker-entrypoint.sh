#!/bin/sh
# Container start. Fetch the runtime secrets from Infisical, then hand the
# process over to node. The only things the container environment has to
# carry are the machine identity's client id and secret; everything the app
# reads (CLERK_SECRET_KEY, VITE_CLERK_PUBLISHABLE_KEY, ...) comes from the
# Infisical environment this image was built for.
#
# See docs/superpowers/specs/2026-09-06-infisical-secrets-design.md.
set -eu

# Names only, never values: enough to tell "Dokploy did not pass the
# identity" from "the identity is wrong" without leaking anything.
echo "entrypoint: environment has: $(env | cut -d= -f1 | sort | tr '\n' ' ')"

: "${INFISICAL_ENV:?INFISICAL_ENV is baked into the image at build time; this image was built without it}"
: "${INFISICAL_CLIENT_ID:?set INFISICAL_CLIENT_ID in the container environment}"
: "${INFISICAL_CLIENT_SECRET:?set INFISICAL_CLIENT_SECRET in the container environment}"

# Same file the build read, so the project id is defined once.
project_id="$(node -p "require('/app/.infisical.json').workspaceId")"

INFISICAL_TOKEN="$(infisical login --method=universal-auth \
  --client-id "$INFISICAL_CLIENT_ID" \
  --client-secret "$INFISICAL_CLIENT_SECRET" \
  --plain --silent)"
export INFISICAL_TOKEN

# The app never needs the identity itself. Drop it before node starts so a
# process dump or a careless console.log(process.env) cannot leak it.
unset INFISICAL_CLIENT_ID INFISICAL_CLIENT_SECRET

# Fail here, with a name, rather than let node start and answer 500 on
# every route. A 500 fails the health check, Swarm rolls the service back
# to the previous spec, and the log you then read belongs to the rollback,
# not to this failure. Names only in the message, never values.
require_secrets='
for k in CLERK_SECRET_KEY VITE_CLERK_PUBLISHABLE_KEY VITE_CONVEX_URL; do
  eval "v=\${$k:-}"
  if [ -z "$v" ]; then
    echo "entrypoint: $k is empty in Infisical environment '"$INFISICAL_ENV"' — fix it there and redeploy" >&2
    exit 1
  fi
done
'

# exec: `infisical run` becomes PID 1 and forwards signals to node, so a
# stop or restart from Dokploy reaches the server instead of being ignored.
exec infisical run --env "$INFISICAL_ENV" --projectId "$project_id" -- \
  sh -c "$require_secrets"'; exec node /app/server.mjs'

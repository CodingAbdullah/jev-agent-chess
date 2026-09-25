#!/usr/bin/env bash
# Set up Jev Chess on this machine, then optionally start it.
#
#   ./scripts/setup.sh                 asks how you want to run it
#   ./scripts/setup.sh local           Node.js: writes .env.local for `npm run dev`
#   ./scripts/setup.sh docker          Docker: writes .env for `docker compose`
#   ./scripts/setup.sh cloud           shows how to add the key to a Claude cloud environment
#   ./scripts/setup.sh vercel          shows how to add the key to Vercel
#   ./scripts/setup.sh local --start   also installs and starts the app
#
# The TypeSafe API key is typed at a hidden prompt, never taken as an argument,
# and saved only in the git-ignored env file, readable by you alone. Leave it
# empty to play against the mock Jev. The Windows version is setup.ps1.

set -euo pipefail

cd "$(dirname "$0")/.."

usage() {
  sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
}

die() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

interactive() {
  [[ -t 0 ]]
}

# ask "Question" -> reads one line into $REPLY, from the terminal or piped input.
ask() {
  REPLY=""
  printf '%s' "$1"
  IFS= read -r REPLY || true
}

mode=""
start=""
for arg in "$@"; do
  case "$arg" in
    local | docker | cloud | vercel)
      [[ -z "$mode" ]] || die "Choose one of local, docker, cloud or vercel."
      mode="$arg"
      ;;
    --start) start=yes ;;
    --no-start) start=no ;;
    -h | --help)
      usage
      exit 0
      ;;
    *) die "Unknown option '$arg'. Run ./scripts/setup.sh --help." ;;
  esac
done

if [[ -z "$mode" ]]; then
  interactive || die "Say how to run it: ./scripts/setup.sh local|docker|cloud|vercel"
  printf 'How do you want to run Jev Chess?\n'
  printf '  1) Node.js on this machine (npm run dev)\n'
  printf '  2) Docker (docker compose)\n'
  printf '  3) Claude Code cloud environment\n'
  printf '  4) Vercel\n'
  ask 'Choose 1-4 [1]: '
  case "${REPLY:-1}" in
    1 | local) mode=local ;;
    2 | docker) mode=docker ;;
    3 | cloud) mode=cloud ;;
    4 | vercel) mode=vercel ;;
    *) die "Please choose 1, 2, 3 or 4." ;;
  esac
fi

if [[ "$mode" == cloud ]]; then
  cat <<'EOF'
Add your TypeSafe key to a Claude Code cloud environment. The key lives in the
environment's settings, never in the repository or the chat.

  1. In a session on claude.ai/code, open the cloud environment menu in the
     session's title bar and choose Edit.
  2. Add TYPESAFE_API_KEY under API credentials if that section is offered,
     otherwise as an environment variable: TYPESAFE_API_KEY=your-key
  3. Add api.typesafe.ai to the environment's allowed network domains.
  4. Start a new session. Settings only reach sessions started afterwards.
  5. In the new session, check the key with: npm run jev:smoke
EOF
  exit 0
fi

if [[ "$mode" == vercel ]]; then
  cat <<'EOF'
Add your TypeSafe key to Vercel. Vercel stores it encrypted and only the
server reads it.

  1. Import the repository at vercel.com/new, or use the Deploy button in
     the README. The button asks for TYPESAFE_API_KEY while it sets up.
  2. For an existing project, open Settings, then Environment Variables, and
     add TYPESAFE_API_KEY for Production and Preview.
  3. Redeploy, since variables apply to new deployments only.

With the Vercel CLI, in a linked project, this asks for the value without
showing it:

  vercel env add TYPESAFE_API_KEY production
EOF
  exit 0
fi

# Check the tools this mode needs.
if [[ "$mode" == local ]]; then
  command -v node >/dev/null || die "Node.js is not installed. Install Node.js 22 from https://nodejs.org."
  command -v npm >/dev/null || die "npm is not installed. It comes with Node.js."
  node_version=$(node -p 'process.versions.node')
  IFS=. read -r node_major node_minor _ <<<"$node_version"
  if ((node_major < 20 || (node_major == 20 && node_minor < 9))); then
    die "Node.js $node_version is too old. Jev Chess needs 20.9 or newer, 22 recommended."
  fi
  env_file=.env.local
else
  command -v docker >/dev/null || die "Docker is not installed. See https://docs.docker.com/get-docker/."
  docker compose version >/dev/null 2>&1 || die "Docker Compose is missing. Install Docker Desktop or the compose plugin."
  env_file=.env
fi

[[ -f .env.example ]] || die ".env.example is missing. Run this from a copy of the Jev Chess repository."

# Keep the env file private: only you can read it.
umask 077
if [[ -f "$env_file" ]]; then
  printf 'Using your existing %s. Its other settings are kept.\n' "$env_file"
else
  cp .env.example "$env_file"
  chmod 600 "$env_file"
  printf 'Created %s from .env.example.\n' "$env_file"
fi

# Whether the env file already holds a key, without reading the key out.
has_key() {
  local line
  while IFS= read -r line || [[ -n "$line" ]]; do
    line=${line%$'\r'}
    [[ "$line" == TYPESAFE_API_KEY=?* ]] && return 0
  done <"$env_file"
  return 1
}

# Replace the TYPESAFE_API_KEY line, or add one. Uses only shell builtins, so
# the key never appears in another process's arguments.
write_key() {
  local key=$1 line found=0 tmp
  tmp=$(mktemp "$env_file.XXXXXX")
  trap 'rm -f "$tmp"' EXIT
  while IFS= read -r line || [[ -n "$line" ]]; do
    line=${line%$'\r'}
    if [[ "$line" == TYPESAFE_API_KEY=* ]]; then
      printf 'TYPESAFE_API_KEY=%s\n' "$key"
      found=1
    else
      printf '%s\n' "$line"
    fi
  done <"$env_file" >"$tmp"
  ((found)) || printf 'TYPESAFE_API_KEY=%s\n' "$key" >>"$tmp"
  mv "$tmp" "$env_file"
  trap - EXIT
}

if has_key; then
  prompt="TypeSafe API key (hidden; press Enter to keep the saved key): "
else
  prompt="TypeSafe API key (hidden; press Enter to play against the mock Jev): "
fi
key=""
printf '%s' "$prompt"
if interactive; then
  IFS= read -rs key || true
else
  IFS= read -r key || true
fi
printf '\n'
key=${key%$'\r'}

if [[ -n "$key" ]]; then
  if [[ "$key" =~ [[:space:]] || "$key" == *[\#\$\"\'\`\\]* ]]; then
    die "That key has spaces or characters such as # \$ or quotes, which env files cannot hold as typed. Edit $env_file by hand."
  fi
  write_key "$key"
  printf 'Saved the key in %s.\n' "$env_file"
elif has_key; then
  printf 'Kept the saved key.\n'
else
  printf 'No key saved: Jev will be the local mock. Run this again to add one.\n'
fi
unset key

# Read a setting from the env file, for the messages below.
setting() {
  local line
  while IFS= read -r line || [[ -n "$line" ]]; do
    line=${line%$'\r'}
    if [[ "$line" == "$1="* ]]; then
      printf '%s' "${line#*=}"
      return
    fi
  done <"$env_file"
}

if has_key && [[ "$(setting JEV_MOCK)" == 1 ]]; then
  printf 'Note: JEV_MOCK=1 in %s, so the mock is used even with a key. Clear it to use the real Jev.\n' "$env_file"
fi

if [[ -z "$start" ]]; then
  if interactive; then
    ask 'Start Jev Chess now? [Y/n]: '
    [[ "$REPLY" =~ ^[Nn] ]] && start=no || start=yes
  else
    start=no
  fi
fi

if [[ "$mode" == local ]]; then
  if [[ "$start" == no ]]; then
    printf '\nNext: npm install, then npm run dev, and open http://localhost:3000\n'
    exit 0
  fi
  if [[ ! -d node_modules ]]; then
    printf '\nInstalling dependencies...\n'
    npm install
  fi
  printf '\nStarting the development server. Open http://localhost:3000 and press Ctrl+C to stop.\n'
  exec npm run dev
fi

port=${PORT:-$(setting PORT)}
port=${port:-3000}
if [[ "$start" == no ]]; then
  printf '\nNext: docker compose up --build, and open http://localhost:%s\n' "$port"
  exit 0
fi
docker info >/dev/null 2>&1 || die "Docker is not running. Start Docker, then run: docker compose up --build -d"
printf '\nBuilding and starting the container. The first build takes a few minutes.\n'
docker compose up --build -d
if command -v curl >/dev/null; then
  printf 'Waiting for the app to answer'
  for _ in $(seq 1 60); do
    if curl -fs -o /dev/null "http://localhost:$port/"; then
      printf '\nJev Chess is running at http://localhost:%s\n' "$port"
      printf 'See the logs with: docker compose logs -f\nStop it with: docker compose down\n'
      exit 0
    fi
    printf '.'
    sleep 2
  done
  printf '\n'
  die "The app did not answer within two minutes. See: docker compose logs"
fi
printf 'Jev Chess is starting at http://localhost:%s\nStop it with: docker compose down\n' "$port"

#!/bin/zsh
cd -- "$(dirname -- "$0")/docsite" || exit 1
if [[ ! -f dist/index.html ]]; then
  npm ci --offline --cache vendor/npm-cache || exit 1
  npm run build || exit 1
fi
node scripts/serve.mjs --no-build

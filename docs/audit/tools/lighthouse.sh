#!/usr/bin/env bash
# Lighthouse 12 (mobile preset: simulated Slow 4G + 4x CPU, Moto G Power viewport) against the
# production server. Install once outside the repo: (cd /tmp/lh && npm i lighthouse@12).
#   LH=/tmp/lh/node_modules/.bin/lighthouse OUT=/tmp/lh-out COOKIE="elba_session=..." docs/audit/tools/lighthouse.sh /ar /en/boxes ...
set -u
LH=${LH:-lighthouse}; OUT=${OUT:-lh-out}; BASE=${BASE:-http://localhost:3000}
CHROME_PATH=${CHROME_PATH:-$(ls -d /opt/pw-browsers/chromium-*/chrome-linux64/chrome | head -1)}
export CHROME_PATH
mkdir -p "$OUT"
for p in "$@"; do
  name=$(echo "$p" | sed 's#^/##; s#/#_#g')
  extra=()
  [ -n "${COOKIE:-}" ] && extra=(--extra-headers "{\"Cookie\":\"$COOKIE\"}")
  "$LH" "$BASE$p" --quiet --output=json --output-path="$OUT/$name.json" \
    --only-categories=performance --chrome-flags="--headless=new --no-sandbox --enable-unsafe-swiftshader" "${extra[@]}" || echo "lighthouse failed for $p"
  node -e '
    const r=require(process.argv[1]); const a=r.audits; const m=(k)=>a[k]?.displayValue??"-";
    console.log(process.argv[2].padEnd(36), "score", Math.round((r.categories.performance.score||0)*100), "FCP", m("first-contentful-paint"), "LCP", m("largest-contentful-paint"), "TBT", m("total-blocking-time"), "CLS", m("cumulative-layout-shift"), "SI", m("speed-index"), "TTI", m("interactive"));
  ' "$OUT/$name.json" "$p"
done

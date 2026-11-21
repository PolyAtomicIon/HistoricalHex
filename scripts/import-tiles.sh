#!/usr/bin/env bash
# Тайлы и спрайты 2D-карты из Codex (art-gen/tiles/<эпоха>/*.png) → public/eras/<эпоха>/*.webp
#   tile-*.png  → tile-*.webp   (512px)
#   robber.png  → robber-unit.webp (320px, прозрачный)
#   attack.png, tank.png → *.webp (512px, прозрачные; для кино-атаки)
set -euo pipefail
cd "$(dirname "$0")/.."
for dir in art-gen/tiles/*/; do
  era=$(basename "$dir")
  out="public/eras/$era"
  mkdir -p "$out"
  for png in "$dir"*.png; do
    [ -e "$png" ] || continue
    name=$(basename "$png" .png)
    case "$name" in
      tile-*) cwebp -quiet -q 78 -resize 512 512 "$png" -o "$out/$name.webp" ;;
      robber) cwebp -quiet -q 82 -alpha_q 90 -resize 320 0 "$png" -o "$out/robber-unit.webp" ;;
      *) cwebp -quiet -q 82 -alpha_q 90 -resize 512 0 "$png" -o "$out/$name.webp" ;;
    esac
  done
  echo "$era: $(ls "$out" | wc -l | tr -d ' ') files"
done

#!/usr/bin/env bash
# Иконки эпох из Codex (art-gen/icons/<эпоха>/*.png, 1024px с прозрачностью) → public/eras/<эпоха>/*.webp (256px)
set -euo pipefail
cd "$(dirname "$0")/.."
for dir in art-gen/icons/*/; do
  era=$(basename "$dir")
  mkdir -p "public/eras/$era"
  for png in "$dir"*.png; do
    [ -e "$png" ] || continue
    name=$(basename "$png" .png)
    cwebp -quiet -q 82 -alpha_q 90 -resize 256 256 "$png" -o "public/eras/$era/$name.webp"
  done
  echo "$era: $(ls "public/eras/$era" | wc -l | tr -d ' ') icons"
done

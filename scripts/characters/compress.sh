#!/usr/bin/env bash
# usage: scripts/characters/compress.sh <raw.glb> <out.glb>
# Draco mesh compression + webp textures. Decoder lives in three/examples/jsm/libs/draco/gltf/.
set -euo pipefail
GT="${GLTF_TRANSFORM:-gltf-transform}"
"$GT" optimize "$1" "$2" --compress draco --texture-compress webp

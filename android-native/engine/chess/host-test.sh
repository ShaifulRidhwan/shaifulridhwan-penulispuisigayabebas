#!/usr/bin/env bash
set -euo pipefail
# Local JRE-only fallback; official Maven downloads, verified before execution.
module_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
cache_dir="${AKSARA_CHESS_TEST_CACHE:-/tmp/aksara-chess-test}"
mkdir -p "$cache_dir/classes"
fetch() {
    local artifact_path="$1" artifact_name="$2" artifact_sha="$3"
    if [ ! -f "$cache_dir/$artifact_name" ]; then
        curl --fail --location --retry 2 "https://repo.maven.apache.org/maven2/$artifact_path" -o "$cache_dir/$artifact_name"
    fi
    printf '%s  %s\n' "$artifact_sha" "$cache_dir/$artifact_name" | sha256sum --check
}
fetch org/eclipse/jdt/ecj/3.42.0/ecj-3.42.0.jar ecj.jar 29f6d3918ee02db4400c103bc25dd90a22491c3a395867d9393070cb96a7dd29
fetch org/apache/commons/commons-lang3/3.18.0/commons-lang3-3.18.0.jar commons.jar 4eeeae8d20c078abb64b015ec158add383ac581571cddc45c68f0c9ae0230720
fetch junit/junit/4.13.2/junit-4.13.2.jar junit.jar 8e495b634469d64fb8acfa3495a065cbacc8a0fff55ce1e31007be4c16dc57d3
fetch org/hamcrest/hamcrest-core/1.3/hamcrest-core-1.3.jar hamcrest.jar 66fdef91e9739348df7a096aa384a5685f4e875584cce89386a7a47251c4d8e9
mapfile -t sources < <(rg --files "$module_dir/src" -g '*.java')
java -jar "$cache_dir/ecj.jar" -17 -nowarn -cp "$cache_dir/commons.jar:$cache_dir/junit.jar:$cache_dir/hamcrest.jar" -d "$cache_dir/classes" "${sources[@]}"
java -cp "$cache_dir/classes:$cache_dir/*" org.junit.runner.JUnitCore my.aksara.engine.chess.ChessSessionTest my.aksara.engine.chess.UciEngineTest my.aksara.engine.chess.QueenDialogueTest

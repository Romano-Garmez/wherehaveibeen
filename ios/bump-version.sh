#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

PBXPROJ="WhereHaveIBeen.xcodeproj/project.pbxproj"
PROJECT_YML="project.yml"

usage() {
    cat <<USAGE
Usage: ./bump-version.sh [build|patch|minor|major|X.Y.Z]

Sets the version and build number in project.yml and the generated Xcode
project for the next TestFlight upload. With no argument, shows the current
values and asks which to bump.

  build     Keep the version, increment the build number (most common).
  patch     1.0.3 -> 1.0.4, build resets to 1
  minor     1.0.3 -> 1.1,   build resets to 1
  major     1.0.3 -> 2.0,   build resets to 1
  X.Y.Z     Set an explicit version, build resets to 1
USAGE
}

setting() {
    sed -n "s/^[[:space:]]*$1 = \(.*\);/\1/p" "$PBXPROJ" | head -n 1
}

current_version=$(setting MARKETING_VERSION)
current_build=$(setting CURRENT_PROJECT_VERSION)

IFS=. read -r major minor patch <<<"$current_version"
minor=${minor:-0}
patch=${patch:-0}

next_from_choice() {
    case "$1" in
        build) new_version=$current_version; new_build=$((current_build + 1)) ;;
        patch) new_version="$major.$minor.$((patch + 1))"; new_build=1 ;;
        minor) new_version="$major.$((minor + 1))"; new_build=1 ;;
        major) new_version="$((major + 1)).0"; new_build=1 ;;
        [0-9]*.[0-9]*) new_version=$1; new_build=1 ;;
        help|-h|--help) usage; exit 0 ;;
        *) echo "Unknown choice: $1" >&2; usage >&2; exit 1 ;;
    esac
}

echo "Current: $current_version ($current_build)"

if [ $# -gt 0 ]; then
    next_from_choice "$1"
else
    echo
    echo "  1) build   -> $current_version ($((current_build + 1)))"
    echo "  2) patch   -> $major.$minor.$((patch + 1)) (1)"
    echo "  3) minor   -> $major.$((minor + 1)) (1)"
    echo "  4) major   -> $((major + 1)).0 (1)"
    echo "  5) custom version"
    echo
    read -r -p "Choice [1]: " choice
    case "${choice:-1}" in
        1) next_from_choice build ;;
        2) next_from_choice patch ;;
        3) next_from_choice minor ;;
        4) next_from_choice major ;;
        5) read -r -p "Version: " custom; next_from_choice "$custom" ;;
        *) echo "Invalid choice" >&2; exit 1 ;;
    esac
fi

sed -i '' \
    -e "s/^\([[:space:]]*MARKETING_VERSION = \).*;/\1$new_version;/" \
    -e "s/^\([[:space:]]*CURRENT_PROJECT_VERSION = \).*;/\1$new_build;/" \
    "$PBXPROJ"
sed -i '' \
    -e "s/^\([[:space:]]*MARKETING_VERSION: \).*/\1\"$new_version\"/" \
    -e "s/^\([[:space:]]*CURRENT_PROJECT_VERSION: \).*/\1\"$new_build\"/" \
    "$PROJECT_YML"

echo "Now:     $new_version ($new_build)"
echo
echo "Next: ./deploy.sh --skip-bump, or in Xcode pick \"Any iOS Device (arm64)\", then Product > Archive > Distribute App > App Store Connect."

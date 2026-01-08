#!/bin/bash
# ==============================================================================
# Script Name: Prepare Release PR
# Description: Bumps version, updates changelog, and opens a Release PR.
# Usage:       ./scripts/prepare-release.sh
# ==============================================================================

set -e

# --- Colors ---
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m'

log_step() { echo -e "\n${BLUE}➜${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; exit 1; }

# --- 1. Pre-flight Checks ---
log_step "Checking Git State..."

if [ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]; then
    log_error "Must start from 'main' branch."
fi

if ! git diff-index --quiet HEAD --; then
    log_error "You have uncommitted changes. Stash or commit them first."
fi

git pull origin main

# --- 2. Determine Version ---
CURRENT_VERSION=$(node -p "require('./package.json').version")
# Simple patch bump logic
MAJOR=$(echo $CURRENT_VERSION | cut -d. -f1)
MINOR=$(echo $CURRENT_VERSION | cut -d. -f2)
PATCH=$(echo $CURRENT_VERSION | cut -d. -f3)
NEXT_VERSION="$MAJOR.$MINOR.$((PATCH + 1))"

echo -e "Current: ${YELLOW}$CURRENT_VERSION${NC}"
echo -e "Next:    ${GREEN}$NEXT_VERSION${NC}"
echo ""
read -p "Press Enter to proceed with v$NEXT_VERSION (or Ctrl+C to cancel)..."

# --- 3. Create Release Branch ---
BRANCH_NAME="release/v$NEXT_VERSION"
log_step "Creating branch $BRANCH_NAME..."
git checkout -b "$BRANCH_NAME"

# --- 4. Bump Files (Package.json & Changelog) ---
log_step "Bumping Version & Changelog..."

# Update package.json
npm version "$NEXT_VERSION" --no-git-tag-version > /dev/null

# Update Changelog Header
DATE=$(date +%Y-%m-%d)
# Mac/Linux sed compatibility
if [ "$(uname)" == "Darwin" ]; then
    sed -i '' "s/## \[Unreleased\]/## [Unreleased]\n\n## [$NEXT_VERSION] - $DATE/" CHANGELOG.md
else
    sed -i "s/## \[Unreleased\]/## [Unreleased]\n\n## [$NEXT_VERSION] - $DATE/" CHANGELOG.md
fi

# Update Changelog Links (Perl regex)
ESC_CURRENT=${CURRENT_VERSION//./\\.}
perl -i -pe "s|\[Unreleased\]: (.*)v$ESC_CURRENT\.\.\.HEAD|[Unreleased]: \$1v$NEXT_VERSION...HEAD\n[$NEXT_VERSION]: \$1v$CURRENT_VERSION...v$NEXT_VERSION|g" CHANGELOG.md

# --- 5. Review & Confirmation (Added Back) ---
echo -e "\n${GRAY}Changes to be committed:${NC}"
git --no-pager diff --stat package.json package-lock.json CHANGELOG.md

echo ""
read -p "Press Enter to commit and push (or Ctrl+C to cancel)..."

# --- 6. Commit & Push ---
log_step "Pushing Branch..."
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: release v$NEXT_VERSION"
git push -u origin "$BRANCH_NAME"

# --- 7. Open Pull Request ---
log_step "Opening Pull Request..."

# Define the PR Body Template
PR_BODY="### 🚀 Release $NEXT_VERSION

This PR finalizes the version bump and changelog updates for the **$NEXT_VERSION** release.

### 🛡️ Architectural & Performance Strategy
- **Optimization**: Synchronizing repository state with latest documentation and configuration refinements.
- **Safeguards**: Verified \`package.json\` and \`CHANGELOG.md\` alignment.
- **Logic**: Automated version bump and link generation.

### ✅ Verification Checklist
- [x] Version updated to \`$NEXT_VERSION\` in \`package.json\`
- [x] \`CHANGELOG.md\` updated with correct date and version header
- [x] Comparison links updated to point to new tag"

# Create PR using GitHub CLI
gh pr create \
  --title "chore: release v$NEXT_VERSION" \
  --body "$PR_BODY" \
  --label "release" \
  --web
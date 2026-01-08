#!/bin/bash
# ==============================================================================
# Script Name: Trigger Release
# Description: Finalizes the release by tagging the current main commit
#              and cleaning up the local release branch.
# Usage:       ./scripts/trigger-release.sh
# ==============================================================================

set -e

# --- Colors ---
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

log_step() { echo -e "\n${BLUE}➜${NC} $1"; }
log_info() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}!${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; exit 1; }

# --- 1. Pre-flight Checks ---
log_step "Syncing with Remote..."

# Ensure we are on main
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}Switching to main...${NC}"
    git checkout main
fi

# Pull the merged PR code
git pull origin main

# --- 2. Detect Version ---
VERSION=$(node -p "require('./package.json').version")
TAG="v$VERSION"
RELEASE_BRANCH="release/$TAG"

log_step "Detected Version: ${YELLOW}$TAG${NC}"

# Check if tag already exists
if git rev-parse "$TAG" >/dev/null 2>&1; then
    log_error "Tag $TAG already exists locally. Has this version already been released?"
fi

# --- 3. Confirmation ---
echo -e "This will create tag ${BOLD}$TAG${NC} and push to origin."
echo -e "It will also delete the local branch ${BOLD}$RELEASE_BRANCH${NC}."
echo ""
read -p "Press Enter to RELEASE (or Ctrl+C to cancel)..."

# --- 4. Tag & Push ---
log_step "Tagging & Pushing..."

git tag "$TAG"
log_info "Created local tag $TAG"

git push origin "$TAG"
log_info "Pushed tag to GitHub"

# --- 5. Cleanup ---
log_step "Cleaning up..."

if git show-ref --verify --quiet "refs/heads/$RELEASE_BRANCH"; then
    git branch -d "$RELEASE_BRANCH"
    log_info "Deleted local branch $RELEASE_BRANCH"
else
    log_warn "Branch $RELEASE_BRANCH not found locally (already deleted?)"
fi

echo -e "\n${GREEN}🚀 Release Triggered!${NC}"
echo -e "Monitor progress here: https://github.com/erclx/ai-context-stacker/actions"
#!/bin/bash
# ==============================================================================
# Script Name: Extension Release Tool
# Description: Automates version bumping, changelog updates, and git tagging
#              for the AI Context Stacker extension.
# Usage:       ./release.sh
# ==============================================================================

set -e
set -o pipefail

# --- Configuration & Colors ---
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
BOLD='\033[1m'
NC='\033[0m'

# --- Utility Functions ---

log_info()  { echo -e "${GREEN}✓${NC} $1"; }
log_warn()  { echo -e "${YELLOW}!${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; exit 1; }
log_step()  { echo -e "\n${BLUE}➜${NC} ${BOLD}$1${NC}"; }

ask() {
  local prompt_text=$1
  local var_name=$2
  local default_val=$3

  if [ -n "$default_val" ]; then
    echo -ne "${CYAN}?${NC} ${prompt_text} ${GRAY}(${default_val})${NC} "
  else
    echo -ne "${CYAN}?${NC} ${prompt_text} "
  fi
  read -r input
  [ -z "$input" ] && input="$default_val"
  export $var_name="$input"
}

check_dependencies() {
    command -v git >/dev/null 2>&1 || log_error "Git is not installed."
    command -v npm >/dev/null 2>&1 || log_error "NPM is not installed."
}

# --- Main Logic ---

main() {
    check_dependencies
    
    # 1. Header
    clear
    echo -e "${BLUE}=== AI Context Stacker Release Workflow ===${NC}\n"

    # 2. Pre-flight Checks
    log_step "Pre-flight Checks"
    
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    if [ "$BRANCH" != "main" ]; then
        log_error "You must be on the 'main' branch. Current: $BRANCH"
    fi

    if ! git diff-index --quiet HEAD --; then
        log_error "You have uncommitted changes. Please commit or stash them first."
    fi
    log_info "Git status is clean."

    CURRENT_VERSION=$(node -p "require('./package.json').version")
    log_info "Current version: $CURRENT_VERSION"

    # 3. Collect Input
    echo ""
    ask "What is the new version?" "NEW_VERSION"
    
    if [[ ! $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        log_error "Invalid version format. Please use semver (e.g., 1.2.3)."
    fi

    if [ "$NEW_VERSION" == "$CURRENT_VERSION" ]; then
        log_error "New version must be different from current version."
    fi

    # 4. Execution
    log_step "Updating Project Files..."

    # Update package.json (without creating a git tag yet)
    npm version "$NEW_VERSION" --no-git-tag-version > /dev/null
    log_info "Bumped package.json to $NEW_VERSION"

    # Update CHANGELOG.md automatically
    # This looks for "## [Unreleased]" and inserts the new version header below it
    DATE=$(date +%Y-%m-%d)
    SEARCH="## \[Unreleased\]"
    REPLACE="## [Unreleased]\n\n## [$NEW_VERSION] - $DATE"
    
    if [ "$(uname)" == "Darwin" ]; then
        sed -i '' "s/$SEARCH/$REPLACE/" CHANGELOG.md
    else
        sed -i "s/$SEARCH/$REPLACE/" CHANGELOG.md
    fi
    log_info "Updated CHANGELOG.md header"

    # 5. Git Operations
    log_step "Git Operations"

    echo -e "${GRAY}Files to be committed:${NC}"
    git --no-pager diff --stat package.json CHANGELOG.md

    echo ""
    ask "Ready to commit and push?" "CONFIRM" "y"
    if [ "$CONFIRM" != "y" ]; then
        git checkout package.json CHANGELOG.md
        log_error "Operation cancelled. Files reverted."
    fi

    git add package.json CHANGELOG.md
    git commit -m "chore: release v$NEW_VERSION" > /dev/null
    log_info "Committed changes"

    git tag "v$NEW_VERSION"
    log_info "Created tag v$NEW_VERSION"

    log_step "Pushing to GitHub..."
    git push origin main
    git push origin "v$NEW_VERSION"

    echo -e "\n${GREEN}Success! v$NEW_VERSION has been pushed.${NC}"
    echo -e "${GRAY}GitHub Actions will now publish to Marketplace and create a Release.${NC}"
}

main "$@"
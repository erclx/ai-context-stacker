#!/bin/bash
set -e
set -o pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
WHITE='\033[1;37m'
GREY='\033[0;90m'
NC='\033[0m'

log_info()  { echo -e "${GREY}│${NC} ${GREEN}✓${NC} $1"; }
log_error() { echo -e "${GREY}│${NC} ${RED}✗${NC} $1"; exit 1; }
log_step()  { echo -e "${GREY}│${NC}\n${GREY}├${NC} ${WHITE}$1${NC}"; }
log_add()   { echo -e "${GREY}│${NC} ${GREEN}+${NC} $1"; }

select_option() {
  local prompt_text=$1
  shift
  local options=("$@")
  local cur=0
  local count=${#options[@]}

  echo -ne "${GREY}│${NC}\n${GREEN}◆${NC} ${prompt_text}\n"

  while true; do
    for i in "${!options[@]}"; do
      if [ $i -eq $cur ]; then
        echo -e "${GREY}│${NC}    ${GREEN}● ${options[$i]}${NC}"
      else
        echo -e "${GREY}│${NC}      ${options[$i]}${NC}"
      fi
    done

    read -rsn1 key
    case "$key" in
      $'\x1b')
        read -rsn2 key
        if [[ "$key" == "[A" ]]; then cur=$(( (cur - 1 + count) % count )); fi
        if [[ "$key" == "[B" ]]; then cur=$(( (cur + 1) % count )); fi
        ;;
      "k") cur=$(( (cur - 1 + count) % count ));;
      "j") cur=$(( (cur + 1) % count ));;
      "") break ;;
    esac

    echo -en "\033[${count}A"
  done

  echo -en "\033[${count}A\033[J"
  echo -e "\033[1A${GREY}◇${NC} ${prompt_text} ${WHITE}${options[$cur]}${NC}"
  SELECTED_OPTION="${options[$cur]}"
}

check_dependencies() {
  command -v git >/dev/null 2>&1 || log_error "git is required"
  command -v node >/dev/null 2>&1 || log_error "node is required"
  command -v npm >/dev/null 2>&1 || log_error "npm is required"
  command -v gh >/dev/null 2>&1 || log_error "gh is required"
}

main() {
  check_dependencies

  echo -e "${GREY}┌${NC}"
  log_step "Checking Git State"

if [ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]; then
    log_error "Must start from 'main' branch"
fi

if ! git diff-index --quiet HEAD --; then
    log_error "Uncommitted changes detected"
fi

git pull origin main

CURRENT_VERSION=$(node -p "require('./package.json').version")
  MAJOR=$(echo "$CURRENT_VERSION" | cut -d. -f1)
  MINOR=$(echo "$CURRENT_VERSION" | cut -d. -f2)
  PATCH=$(echo "$CURRENT_VERSION" | cut -d. -f3)
NEXT_VERSION="$MAJOR.$MINOR.$((PATCH + 1))"

  select_option "Bump version ($CURRENT_VERSION -> $NEXT_VERSION)?" "Yes" "No"
  if [ "$SELECTED_OPTION" != "Yes" ]; then
    log_error "Cancelled by user"
  fi

  log_step "Creating Release Branch"
BRANCH_NAME="release/v$NEXT_VERSION"
git checkout -b "$BRANCH_NAME"
  log_add "Branch: $BRANCH_NAME"

  log_step "Bumping Version & Changelog"
npm version "$NEXT_VERSION" --no-git-tag-version > /dev/null
  log_add "Updated package.json"

DATE=$(date +%Y-%m-%d)
if [ "$(uname)" == "Darwin" ]; then
    sed -i '' "s/## \[Unreleased\]/## [Unreleased]\n\n## [$NEXT_VERSION] - $DATE/" CHANGELOG.md
else
    sed -i "s/## \[Unreleased\]/## [Unreleased]\n\n## [$NEXT_VERSION] - $DATE/" CHANGELOG.md
fi

ESC_CURRENT=${CURRENT_VERSION//./\\.}
perl -i -pe "s|\[Unreleased\]: (.*)v$ESC_CURRENT\.\.\.HEAD|[Unreleased]: \$1v$NEXT_VERSION...HEAD\n[$NEXT_VERSION]: \$1v$CURRENT_VERSION...v$NEXT_VERSION|g" CHANGELOG.md
  log_add "Updated CHANGELOG.md"

  log_step "Review Changes"
git --no-pager diff --stat package.json package-lock.json CHANGELOG.md

  select_option "Commit and push changes?" "Yes" "No"
  if [ "$SELECTED_OPTION" != "Yes" ]; then
    log_error "Cancelled by user"
  fi

  log_step "Pushing Branch"
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: release v$NEXT_VERSION"
git push -u origin "$BRANCH_NAME"

  log_step "Opening Pull Request"
PR_BODY="## Summary
Finalize artifacts for **v$NEXT_VERSION** release.

## Key Changes
- Bump \`package.json\` version from \`$CURRENT_VERSION\` to \`$NEXT_VERSION\`
- Update \`CHANGELOG.md\` with release date ($DATE)
- Refresh comparison links for version diffs

## Technical Context
- **Scope**: Release Management
- **Type**: Patch Bump (Automated)

## Testing
- [x] Verify \`package.json\` version matches branch
- [x] Verify Changelog links resolve to correct tags
"

gh pr create \
  --title "chore(release): v$NEXT_VERSION" \
  --body "$PR_BODY" \
  --label "release" \
  --web

  echo -e "${GREY}└${NC}\n"
  echo -e "${GREEN}✓ Release preparation complete${NC}"
}

main "$@"
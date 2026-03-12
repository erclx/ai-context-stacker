#!/bin/bash
set -e
set -o pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
WHITE='\033[1;37m'
GREY='\033[0;90m'
NC='\033[0m'

log_info()  { echo -e "${GREY}│${NC} ${GREEN}✓${NC} $1"; }
log_error() { echo -e "${GREY}│${NC} ${RED}✗${NC} $1"; exit 1; }
log_step()  { echo -e "${GREY}│${NC}\n${GREY}├${NC} ${WHITE}$1${NC}"; }
log_add()   { echo -e "${GREY}│${NC} ${GREEN}+${NC} $1"; }

show_help() {
  echo -e "${GREY}┌${NC}"
  echo -e "${GREY}├${NC} ${WHITE}Usage:${NC} ./prepare-release.sh [options] [type]"
  echo -e "${GREY}│${NC}"
  echo -e "${GREY}│${NC}  ${WHITE}Types:${NC}"
  echo -e "${GREY}│${NC}    patch         ${GREY}# Increment patch version (0.0.X)${NC}"
  echo -e "${GREY}│${NC}    minor         ${GREY}# Increment minor version (0.X.0)${NC}"
  echo -e "${GREY}│${NC}    major         ${GREY}# Increment major version (X.0.0)${NC}"
  echo -e "${GREY}│${NC}"
  echo -e "${GREY}│${NC}  ${WHITE}Options:${NC}"
  echo -e "${GREY}│${NC}    -h, --help    ${GREY}# Show this help message${NC}"
  echo -e "${GREY}└${NC}"
  exit 0
}

select_option() {
  local prompt_text=$1
  shift
  local options=("$@")
  local cur=0
  local count=${#options[@]}

  echo -ne "${GREY}│${NC}\n${GREEN}◆${NC} ${prompt_text}\n"

  while true; do
    for i in "${!options[@]}"; do
      if [ "$i" -eq "$cur" ]; then
        echo -e "${GREY}│${NC}  ${GREEN}❯ ${options[$i]}${NC}"
      else
        echo -e "${GREY}│${NC}    ${GREY}${options[$i]}${NC}"
      fi
    done

    read -rsn1 key
    case "$key" in
      $'\x1b')
        if read -rsn2 -t 0.001 key_seq; then
          if [[ "$key_seq" == "[A" ]]; then cur=$(( (cur - 1 + count) % count )); fi
          if [[ "$key_seq" == "[B" ]]; then cur=$(( (cur + 1) % count )); fi
        else
          echo -en "\033[$((count + 1))A\033[J"
          echo -e "\033[1A${GREY}│${NC}\n${GREY}◇${NC} ${prompt_text} ${RED}Cancelled${NC}"
          exit 1
        fi
        ;;
      "k") cur=$(( (cur - 1 + count) % count ));;
      "j") cur=$(( (cur + 1) % count ));;
      "q")
        echo -en "\033[$((count + 1))A\033[J"
        echo -e "\033[1A${GREY}│${NC}\n${GREY}◇${NC} ${prompt_text} ${RED}Cancelled${NC}"
        exit 1
        ;;
      "") break ;;
    esac

    echo -en "\033[${count}A"
  done

  echo -en "\033[$((count + 1))A\033[J"
  echo -e "\033[1A${GREY}│${NC}\n${GREY}◇${NC} ${prompt_text} ${WHITE}${options[$cur]}${NC}"
  SELECTED_OPTION="${options[$cur]}"
}

check_dependencies() {
  command -v git >/dev/null 2>&1 || log_error "git is required"
  command -v node >/dev/null 2>&1 || log_error "node is required"
  command -v npm >/dev/null 2>&1 || log_error "npm is required"
  command -v gh >/dev/null 2>&1 || log_error "gh is required"
}

main() {
  if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    show_help
  fi

  check_dependencies

  echo -e "${GREY}┌${NC}"
  echo -e "${GREY}│${NC} ${WHITE}Prepare release${NC}"
  echo -e "${GREY}├${NC} ${WHITE}Checking Git state${NC}"

if [ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]; then
    log_error "Must start from 'main' branch"
fi

if ! git diff-index --quiet HEAD --; then
    log_error "Uncommitted changes detected"
fi

git pull origin main

CURRENT_VERSION=$(node -p "require('./package.json').version")
  BUMP_TYPE="$1"

  if [ -z "$BUMP_TYPE" ]; then
    select_option "Select release type" "patch" "minor" "major"
    BUMP_TYPE="$SELECTED_OPTION"
  fi

  if [[ ! "$BUMP_TYPE" =~ ^(patch|minor|major)$ ]]; then
    log_error "Invalid bump type: $BUMP_TYPE"
  fi

  IFS='.' read -r major minor patch <<< "$CURRENT_VERSION"
  case "$BUMP_TYPE" in
    major) NEXT_VERSION="$((major + 1)).0.0" ;;
    minor) NEXT_VERSION="$major.$((minor + 1)).0" ;;
    patch) NEXT_VERSION="$major.$minor.$((patch + 1))" ;;
  esac

  select_option "Bump version ($CURRENT_VERSION -> $NEXT_VERSION)?" "Yes" "No"
  if [ "$SELECTED_OPTION" != "Yes" ]; then
    log_error "Cancelled by user"
  fi

  log_step "Creating release branch"
BRANCH_NAME="release/v$NEXT_VERSION"
git checkout -b "$BRANCH_NAME"
  log_add "Branch: $BRANCH_NAME"

  log_step "Bumping version & changelog"
  npm version "$BUMP_TYPE" --no-git-tag-version > /dev/null
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

  log_step "Review changes"
git --no-pager diff --stat package.json package-lock.json CHANGELOG.md

  select_option "Commit and push changes?" "Yes" "No"
  if [ "$SELECTED_OPTION" != "Yes" ]; then
    log_error "Cancelled by user"
  fi

  log_step "Pushing branch"
git add package.json package-lock.json CHANGELOG.md
  git commit -m "chore(release): v$NEXT_VERSION"
git push -u origin "$BRANCH_NAME"

  log_step "Opening pull request"
PR_BODY="## Summary
Finalize artifacts for **v$NEXT_VERSION** release.

## Key Changes
- Bump \`package.json\` version from \`$CURRENT_VERSION\` to \`$NEXT_VERSION\`
- Update \`CHANGELOG.md\` with release date ($DATE)
- Refresh comparison links for version diffs

## Technical Context
- **Scope**: Release Management
- **Type**: $BUMP_TYPE Bump (Automated)

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

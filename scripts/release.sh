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
log_warn()  { echo -e "${GREY}│${NC} ${YELLOW}!${NC} $1"; }
log_error() { echo -e "${GREY}│${NC} ${RED}✗${NC} $1"; exit 1; }
log_step()  { echo -e "${GREY}│${NC}\n${GREY}├${NC} ${WHITE}$1${NC}"; }
log_add()   { echo -e "${GREY}│${NC} ${GREEN}+${NC} $1"; }

close_timeline() {
  echo -e "${GREY}└${NC}"
}

show_help() {
  echo -e "${GREY}┌${NC}"
  echo -e "${GREY}├${NC} ${WHITE}Usage:${NC} ./release.sh [options] [type]"
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
  command -v git >/dev/null 2>&1  || log_error "git is required"
  command -v node >/dev/null 2>&1 || log_error "node is required"
  command -v npm >/dev/null 2>&1  || log_error "npm is required"
  command -v gh >/dev/null 2>&1   || log_error "gh is required"
  command -v perl >/dev/null 2>&1 || log_error "perl is required"
}

validate_git_state() {
  if [ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]; then
    log_error "Must start from 'main' branch"
  fi
  if ! git diff-index --quiet HEAD --; then
    log_error "Uncommitted changes detected"
  fi
  git pull origin main
  log_info "Git state valid"
}

compute_next_version() {
  local bump_type=$1
  CURRENT_VERSION=$(node -p "require('./package.json').version")
  IFS='.' read -r major minor patch <<< "$CURRENT_VERSION"
  case "$bump_type" in
    major) NEXT_VERSION="$((major + 1)).0.0" ;;
    minor) NEXT_VERSION="${major}.$((minor + 1)).0" ;;
    patch) NEXT_VERSION="${major}.${minor}.$((patch + 1))" ;;
  esac
}

create_release_branch() {
  BRANCH_NAME="release/v${NEXT_VERSION}"
  git checkout -b "$BRANCH_NAME"
  log_add "Branch: $BRANCH_NAME"
}

bump_version() {
  npm version "$BUMP_TYPE" --no-git-tag-version > /dev/null
  log_add "package.json → $NEXT_VERSION"
}

update_changelog() {
  local date
  date=$(date +%Y-%m-%d)
  local esc_current="${CURRENT_VERSION//./\\.}"

  if [ "$(uname)" = "Darwin" ]; then
    sed -i '' "s/## \[Unreleased\]/## [Unreleased]\n\n## [${NEXT_VERSION}] - ${date}/" CHANGELOG.md
  else
    sed -i "s/## \[Unreleased\]/## [Unreleased]\n\n## [${NEXT_VERSION}] - ${date}/" CHANGELOG.md
  fi

  perl -i -pe "s|\[Unreleased\]: (.*)v${esc_current}\.\.\.HEAD|[Unreleased]: \$1v${NEXT_VERSION}...HEAD\n[${NEXT_VERSION}]: \$1v${CURRENT_VERSION}...v${NEXT_VERSION}|g" CHANGELOG.md
  log_add "CHANGELOG.md → $NEXT_VERSION ($date)"
}

push_branch() {
  git add package.json package-lock.json CHANGELOG.md
  git commit -m "chore(release): v${NEXT_VERSION}"
  git push -u origin "$BRANCH_NAME"
  log_info "Branch pushed"
}

open_pull_request() {
  local pr_body
  pr_body="## Summary
Finalize artifacts for v${NEXT_VERSION} release.

## Changes
- Bump \`package.json\` version from \`${CURRENT_VERSION}\` to \`${NEXT_VERSION}\`
- Update \`CHANGELOG.md\` with release date ($(date +%Y-%m-%d))
- Refresh comparison links for version diffs

## Testing
- [x] Verify \`package.json\` version matches branch
- [x] Verify changelog links resolve to correct tags"

  local pr_url
  pr_url=$(gh pr create \
    --title "chore(release): v${NEXT_VERSION}" \
    --body "$pr_body" \
    --label "release")

  PR_NUMBER=$(echo "$pr_url" | grep -oE '[0-9]+$')
  log_add "PR #${PR_NUMBER}: $pr_url"
}

wait_for_merge() {
  log_warn "Waiting for PR #${PR_NUMBER} to merge — review and approve on GitHub"

  while true; do
    local state
    state=$(gh pr view "$PR_NUMBER" --json state --jq '.state')

    if [ "$state" = "MERGED" ]; then
      log_info "PR #${PR_NUMBER} merged"
      break
    fi

    if [ "$state" = "CLOSED" ]; then
      log_error "PR #${PR_NUMBER} was closed without merging"
    fi

    sleep 15
  done
}

tag_release() {
  git checkout main
  git pull origin main

  local tag="v${NEXT_VERSION}"

  if git rev-parse "$tag" >/dev/null 2>&1; then
    log_error "Tag $tag already exists"
  fi

  git tag "$tag"
  git push origin "$tag"
  log_add "Tag: $tag"
}

cleanup_branch() {
  if git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}"; then
    git branch -d "$BRANCH_NAME"
    log_info "Deleted local branch $BRANCH_NAME"
  else
    log_warn "Local branch $BRANCH_NAME not found, skipping cleanup"
  fi
}

main() {
  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    show_help
  fi

  check_dependencies

  echo -e "${GREY}┌${NC}"
  echo -e "${GREY}│${NC} ${WHITE}Release${NC}"
  echo -e "${GREY}├${NC} ${WHITE}Checking Git state${NC}"
  trap close_timeline EXIT

  validate_git_state

  BUMP_TYPE="${1:-}"

  if [ -z "$BUMP_TYPE" ]; then
    select_option "Select release type" "patch" "minor" "major"
    BUMP_TYPE="$SELECTED_OPTION"
  fi

  if [[ ! "$BUMP_TYPE" =~ ^(patch|minor|major)$ ]]; then
    log_error "Invalid bump type: $BUMP_TYPE"
  fi

  compute_next_version "$BUMP_TYPE"

  select_option "Bump version ($CURRENT_VERSION → $NEXT_VERSION)?" "Yes" "No"
  if [ "$SELECTED_OPTION" != "Yes" ]; then
    exit 1
  fi

  log_step "Creating release branch"
  create_release_branch

  log_step "Bumping version and changelog"
  bump_version
  update_changelog

  log_step "Review changes"
  git --no-pager diff --stat package.json package-lock.json CHANGELOG.md

  select_option "Commit and push?" "Yes" "No"
  if [ "$SELECTED_OPTION" != "Yes" ]; then
    exit 1
  fi

  log_step "Pushing branch"
  push_branch

  log_step "Opening pull request"
  open_pull_request

  log_step "Waiting for merge"
  wait_for_merge

  log_step "Tagging release"
  tag_release

  log_step "Cleaning up"
  cleanup_branch

  trap - EXIT
  echo -e "${GREY}└${NC}\n"
  echo -e "${GREEN}✓ Release v${NEXT_VERSION} triggered — monitor: https://github.com/erclx/stackr/actions${NC}"
}

main "$@"

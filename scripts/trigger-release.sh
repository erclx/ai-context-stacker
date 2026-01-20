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

select_option() {
  local prompt_text=$1
  shift
  local options=("$@")
  local cur=0
  local count=${#options[@]}
  local index=0
  local esc=$(echo -en "\033")

  echo -ne "${GREY}│${NC}\n${GREEN}◆${NC} ${prompt_text}\n"
  tput civis

  while true; do
    index=0
    for o in "${options[@]}"; do
      if [ "$index" == "$cur" ]; then
        echo -e "${GREY}│${NC}   ${GREEN}● ${o}${NC}\033[K"
      else
        echo -e "${GREY}│${NC}     ${o}\033[K"
      fi
      ((index++))
    done

    read -rsn1 key
    if [[ "$key" == "$esc" ]]; then
      read -rsn2 -t 0.001 key
      [[ "$key" == "[A" ]] && key="k"
      [[ "$key" == "[B" ]] && key="j"
    fi

    case "$key" in
      k|K) ((cur > 0)) && ((cur--)) ;;
      j|J) ((cur < count-1)) && ((cur++)) ;;
      "") break ;;
    esac

    echo -en "\033[${count}A"
  done

  echo -en "\033[${count}A\033[J"
  echo -e "\033[1A${GREY}◇${NC} ${prompt_text} ${WHITE}${options[$cur]}${NC}"
  tput cnorm
  SELECTED_OPTION="${options[$cur]}"
}

check_dependencies() {
  command -v git >/dev/null 2>&1 || log_error "git is required"
  command -v node >/dev/null 2>&1 || log_error "node is required"
}

main() {
  check_dependencies

  echo -e "${GREY}┌${NC}"
  log_step "Syncing with Remote"

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    log_warn "Switching from $CURRENT_BRANCH to main"
    git checkout main
fi
git pull origin main

  log_step "Detecting Version"
VERSION=$(node -p "require('./package.json').version")
TAG="v$VERSION"
RELEASE_BRANCH="release/$TAG"

  log_info "Detected Version: $TAG"

if git rev-parse "$TAG" >/dev/null 2>&1; then
    log_error "Tag $TAG already exists locally"
  fi

  select_option "Confirm release of $TAG?" "Yes" "No"
  if [ "$SELECTED_OPTION" != "Yes" ]; then
    log_error "Release cancelled by user"
  fi

  log_step "Tagging & Pushing"
git tag "$TAG"
log_info "Created local tag $TAG"
git push origin "$TAG"
log_info "Pushed tag to GitHub"

  log_step "Cleaning up"
if git show-ref --verify --quiet "refs/heads/$RELEASE_BRANCH"; then
    git branch -d "$RELEASE_BRANCH"
    log_info "Deleted local branch $RELEASE_BRANCH"
else
    log_warn "Branch $RELEASE_BRANCH not found locally"
fi

  echo -e "${GREY}└${NC}\n"
  echo -e "${GREEN}✓ Release Triggered! Monitor: https://github.com/erclx/ai-context-stacker/actions${NC}"
}

main "$@"
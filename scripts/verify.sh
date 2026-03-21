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

close_timeline() {
  echo -e "${GREY}└${NC}"
}

check_dependencies() {
  command -v npm >/dev/null 2>&1 || log_error "npm is required"
}

main() {
  check_dependencies

  echo -e "${GREY}┌${NC}"
  echo -e "${GREY}│${NC} ${WHITE}Verify${NC}"
  echo -e "${GREY}├${NC} ${WHITE}Typecheck${NC}"
  trap close_timeline EXIT

  npm run typecheck
  log_info "Passed"

  log_step "Lint"
  npm run lint
  log_info "Passed"

  log_step "Format"
  npm run check:format
  log_info "Passed"

  log_step "Spell"
  npm run check:spell
  log_info "Passed"

  log_step "Shell"
  npm run check:shell
  log_info "Passed"

  trap - EXIT
  echo -e "${GREY}└${NC}\n"
  echo -e "${GREEN}✓ All checks passed${NC}"
}

main "$@"

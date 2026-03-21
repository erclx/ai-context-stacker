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
  echo -e "${GREY}│${NC} ${WHITE}Update${NC}"
  echo -e "${GREY}├${NC} ${WHITE}Updating dependencies${NC}"
  trap close_timeline EXIT

  npm update
  log_info "Dependencies updated"

  log_step "Installing"
  npm install
  log_info "Lockfile synced"

  trap - EXIT
  echo -e "${GREY}└${NC}\n"
  echo -e "${GREEN}✓ Update complete${NC}"
}

main "$@"

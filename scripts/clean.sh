#!/bin/bash
set -e
set -o pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
WHITE='\033[1;37m'
GREY='\033[0;90m'
NC='\033[0m'

log_rem()   { echo -e "${GREY}│${NC} ${RED}-${NC} $1"; }

close_timeline() {
  echo -e "${GREY}└${NC}"
}

main() {
  echo -e "${GREY}┌${NC}"
  echo -e "${GREY}│${NC} ${WHITE}Clean${NC}"
  echo -e "${GREY}├${NC} ${WHITE}Removing build artifacts${NC}"
  trap close_timeline EXIT

  rm -rf dist out
  log_rem "dist/"
  log_rem "out/"

  trap - EXIT
  echo -e "${GREY}└${NC}\n"
  echo -e "${GREEN}✓ Clean complete${NC}"
}

main "$@"

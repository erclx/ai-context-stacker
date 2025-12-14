#!/bin/bash
# ==============================================================================
# Extension Reset Tool
# Description: Resets a VS Code extension project by clearing metadata,
#              regenerating documentation, and reinitializing Git history.
# Usage:       ./reset_extension.sh
# ==============================================================================

set -e

# --- ANSI Color Configuration ---
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
WHITE='\033[0;37m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# --- CLI Banner Rendering ---
clear
echo -e "${NC}"
echo -e "${BLUE}     /\\      ${WHITE}╭──────────────────────────╮${NC}"
echo -e "${BLUE}    /  \\     ${WHITE}│   Welcome to the VS Code │${NC}"
echo -e "${BLUE}   / /\\ \\    ${WHITE}│   Extension Reset Tool   │${NC}"
echo -e "${BLUE}  / /  \\ \\   ${WHITE}╰──────────────────────────╯${NC}"
echo -e "${BLUE} / /    \\ \\ ${NC}"
echo -e "${BLUE}/_/      \\_\\\\${NC}"
echo -e ""

# --- Utility Functions ---

# Prompts the user for input and exports the result to an environment variable.
# Arguments:
#   $1: The prompt text to display.
#   $2: The variable name to export.
#   $3: The default value (optional).
ask() {
  local prompt_text=$1
  local var_name=$2
  local default_val=$3

  if [ -n "$default_val" ]; then
    echo -ne "${BLUE}?${NC} ${BOLD}${prompt_text}${NC} ${GRAY}(${default_val})${NC} "
  else
    echo -ne "${BLUE}?${NC} ${BOLD}${prompt_text}${NC} "
  fi

  echo -ne "${CYAN}"
  read input
  echo -ne "${NC}"

  if [ -z "$input" ]; then
    export $var_name="$default_val"
  else
    export $var_name="$input"
  fi
  
  # Show check mark after answer
  local answer_value="${!var_name}"
  tput cuu1  # Move cursor up one line
  tput el    # Clear line
  if [ -n "$default_val" ] && [ -z "$input" ]; then
    echo -e "${GREEN}✓${NC} ${BOLD}${prompt_text}${NC} ${GRAY}· ${answer_value}${NC}"
  else
    echo -e "${GREEN}✓${NC} ${BOLD}${prompt_text}${NC} ${GRAY}· ${answer_value}${NC}"
  fi
}

# Renders the interactive menu options to the terminal.
# Uses ANSI colors and a '❯' prefix to highlight the currently selected option.
# Arguments:
#   $1: The prompt text for the menu.
#   $2: The currently selected option number (1 or 2).
render_menu() {
  local prompt_text=$1
  local selected=$2

  echo -e "${BLUE}?${NC} ${BOLD}${prompt_text}${NC}"
  
  if [ "$selected" -eq 1 ]; then
    echo -e "${CYAN}❯ Open with \`code\`${NC}"
    echo -e "  Skip"
  else
    echo -e "  Open with \`code\`"
    echo -e "${CYAN}❯ Skip${NC}"
  fi
  
  echo -e "${GRAY}navigate ⬆ ⬇ select ⏎${NC}"
}

# Displays an interactive selection menu using key presses.
# Arguments:
#   $1: The prompt text to display.
#   $2: The variable name to export the selection to (1 or 2).
ask_choice() {
  local prompt_text=$1
  local var_name=$2
  local selected=1
  local lines_to_clear=4
  
  tput civis

  # Initial render outside the loop
  render_menu "$prompt_text" "$selected"

  while true; do
    read -rsn1 key
    
    # 1. Update selection based on key press
    local selection_changed=0
    if [ "$key" = "" ]; then
      break
    elif [ "$key" = $'\x1b' ]; then
      read -rsn2 key
      case "$key" in
        '[A')
          selected=$((selected - 1))
          if [ "$selected" -lt 1 ]; then
            selected=2
          fi
          selection_changed=1
          ;;
        '[B')
          selected=$((selected + 1))
          if [ "$selected" -gt 2 ]; then
            selected=1
          fi
          selection_changed=1
          ;;
      esac
    fi

    # 2. Re-render only if selection changed
    if [ "$selection_changed" -eq 1 ]; then
      # Move cursor up 4 lines and clear screen from cursor down (J)
      printf "\033[${lines_to_clear}A\033[J"
      render_menu "$prompt_text" "$selected"
    fi
  done
  
  # Final cleanup and export
  tput cnorm
  
  # Move cursor up and clear the entire interactive menu
  printf "\033[${lines_to_clear}A\033[J"
  
  local choice_text
  if [ "$selected" -eq 1 ]; then
      choice_text="Open with \`code\`"
  else
      choice_text="Skip"
  fi
  echo -e "${GREEN}✓${NC} ${BOLD}${prompt_text}${NC} ${GRAY}· ${choice_text}${NC}"
  echo ""
  
  export $var_name="$selected"
}

# Formats and logs status updates to the console.
log_action() {
  local action=$1
  local file=$2
  echo -e "   ${GREEN}${action}${NC} ${file}${NC}"
}

# --- 1. Configuration: Collect Extension Metadata ---

ask "What's the name of your extension?" "PKG_DISPLAY" "My Extension"

DEFAULT_ID=$(echo "$PKG_DISPLAY" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')

ask "What's the identifier of your extension?" "PKG_NAME" "$DEFAULT_ID"
ask "What's the description of your extension?" "PKG_DESC" ""

echo ""

# --- 2. File Generation: Update Project Metadata ---

echo -e "${WHITE}Writing in ${PWD}...${NC}"

log_action "update" "package.json"
log_action "update" "README.md"
log_action "update" "CHANGELOG.md"

# Execute Node.js script to rewrite JSON and Markdown files
node -e "
  const fs = require('fs');
  const path = require('path');
   
  // Update package.json with new metadata and remove reset scripts
  const pkgPath = 'package.json';
  if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      
      pkg.name = process.env.PKG_NAME;
      pkg.displayName = process.env.PKG_DISPLAY;
      pkg.description = process.env.PKG_DESC;
      pkg.version = '0.0.1';
      
      if (pkg.scripts && pkg.scripts.reset) {
        delete pkg.scripts.reset;
      }
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }

  // Regenerate README.md
  const readmeContent = \`# \${process.env.PKG_DISPLAY}

## Description

\${process.env.PKG_DESC || '[Add your extension description here]'}

## Features

- Feature 1
- Feature 2
\`;
  fs.writeFileSync('README.md', readmeContent);

  // Initialize CHANGELOG.md
  const changelogContent = \`# Change Log

All notable changes to the \"\${process.env.PKG_DISPLAY}\" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- Initial release
\`;
  fs.writeFileSync('CHANGELOG.md', changelogContent);
"

# --- 3. Version Control: Reset History ---
log_action "reset" ".git"

rm -rf .git
git init --initial-branch=main > /dev/null 2>&1
git add .
git commit -m "chore: initial commit" --quiet > /dev/null 2>&1

echo ""
echo -e "${WHITE}Your extension ${CYAN}${PKG_DISPLAY}${WHITE} has been created!${NC}"
echo ""
echo -e "${WHITE}To start editing:${NC}"
echo -e "   ${CYAN}code .${NC}"
echo ""

# --- 4. Validation: Check Directory Name ---
CURRENT_DIR=$(basename "$PWD")
if [ "$CURRENT_DIR" != "$PKG_NAME" ]; then
  echo -e "${YELLOW}Note: The folder is still named '${CURRENT_DIR}'.${NC}"
  echo -e "${YELLOW}To rename it to your identifier, run:${NC}"
  echo -e "${CYAN}   cd .. && mv \"$CURRENT_DIR\" \"$PKG_NAME\" && cd \"$PKG_NAME\"${NC}"
  echo ""
fi

# --- 5. VS Code Opening Prompt ---
ask_choice "Do you want to open the new folder with Visual Studio Code?" "OPEN_VSCODE"

echo ""

if [ "$OPEN_VSCODE" = "1" ]; then
  if command -v code &> /dev/null; then
    echo -e "${WHITE}Opening in VS Code...${NC}"
    code .
  else
    echo -e "${YELLOW}Warning: 'code' command not found in PATH.${NC}"
    echo -e "${YELLOW}Please open VS Code manually or add 'code' to your PATH.${NC}"
  fi
else
  echo -e "${WHITE}To start editing later, run:${NC}"
  echo -e "   ${CYAN}code .${NC}"
fi

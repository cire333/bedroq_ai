#!/bin/bash
# tools/update-subtrees.sh

echo "Updating KiCanvas..."
git subtree pull --prefix=packages/kicanvas-integration \
  https://github.com/theacodes/kicanvas.git main --squash

# echo "Updating Chatbot UI..."  
# git subtree pull --prefix=packages/chatbot-integration \
#   https://github.com/mckaywrigley/chatbot-ui.git main --squash

echo "Installing dependencies..."
npm install

echo "Building all packages..."
npm run build:all
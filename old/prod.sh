#!/bin/bash

set -e

git reset HEAD --hard
git pull
npm install --force
npm run build
pm2 restart cdn
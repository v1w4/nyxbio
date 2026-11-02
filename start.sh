#!/usr/bin/env bash
# start.sh — entrypoint para Render / Railway / qualquer host Node.
# Seta variáveis e inicia o server.
set -e

# sessão segura: gera se vazio
: "${SESSION_SECRET:=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")}"

exec node server.js

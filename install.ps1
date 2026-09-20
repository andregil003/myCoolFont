#Requires -Version 5.1
# myCoolFont — instalador de dependencias (Windows)
# Autor: Jorge André Gil Leonardo — todo 100% gratis y local.
# Uso: powershell -ExecutionPolicy Bypass -File install.ps1

$ErrorActionPreference = 'Continue'
Write-Host 'myCoolFont — instalando dependencias...' -ForegroundColor Cyan

function Test-Cmd($name) { $null -ne (Get-Command $name -ErrorAction SilentlyContinue) }

# 1. Node 18+ (núcleo del CLI + draw-your-font vía npx, no requiere instalación global)
if (Test-Cmd 'node') { Write-Host ('[OK] node ' + (node --version)) } else { Write-Host '[FALTA] node 18+: https://nodejs.org (obligatorio)' -ForegroundColor Yellow }

# 2. draw-your-font global (opcional: el CLI usa npx como fallback automático)
if (Test-Cmd 'draw-your-font') { Write-Host '[OK] draw-your-font global' } else { Write-Host '[INFO] draw-your-font se usará vía npx (sin instalar). Opcional: npm i -g draw-your-font' }

# 3. jitter (variantes calt + render). Requiere Rust.
if (Test-Cmd 'jitter') { Write-Host '[OK] jitter' }
elseif (Test-Cmd 'cargo') { Write-Host 'Instalando jitter con cargo...'; cargo install jitter }
else { Write-Host '[FALTA] Rust/cargo para jitter: https://rustup.rs (variantes y preview no funcionarán sin esto)' -ForegroundColor Yellow }

# 4. Python + fonttools (solo modo --reales / myfont)
if (Test-Cmd 'python') { Write-Host '[OK] python'; python -m pip install --upgrade fonttools 2>$null; Write-Host '[OK] fonttools' }
else { Write-Host '[INFO] python no encontrado (solo necesario para variantes REALES dibujadas)' }

# 5. Herramientas extra solo para --reales
foreach ($t in @('pdftoppm', 'potrace', 'pdflatex')) {
  if (Test-Cmd $t) { Write-Host "[OK] $t" } else { Write-Host "[INFO] $t no encontrado (solo necesario para --reales)" }
}

Write-Host ''
Write-Host 'Listo. Verifica con: node bin/mycoolfont.js doctor' -ForegroundColor Green

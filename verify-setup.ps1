#!/usr/bin/env powershell
# verify-setup.ps1 — Verify OurShow auth setup

Write-Host "🔍 OurShow Authentication Setup Verification" -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan

$errors = @()
$warnings = @()
$successes = @()

# Check required files exist
$requiredFiles = @(
  "login.html",
  "index.html",
  "community.html",
  "community.js",
  "post.html",
  "post.js",
  "firebase-config.js",
  "config.js",
  "main.js"
)

Write-Host "📁 Checking files..." -ForegroundColor Yellow
foreach ($file in $requiredFiles) {
  if (Test-Path $file) {
    $successes += "✅ $file exists"
    Write-Host "✅ $file exists" -ForegroundColor Green
  } else {
    $errors += "❌ $file missing"
    Write-Host "❌ $file missing" -ForegroundColor Red
  }
}

Write-Host ""

# Check firebase-config.js has correct content
Write-Host "🔧 Checking firebase-config.js..." -ForegroundColor Yellow
$configContent = Get-Content firebase-config.js -Raw
if ($configContent -match 'window\.dbMod') {
  $successes += "✅ firebase-config.js exposes window.dbMod"
  Write-Host "✅ firebase-config.js exposes window.dbMod" -ForegroundColor Green
} else {
  $errors += "❌ firebase-config.js missing window.dbMod"
  Write-Host "❌ firebase-config.js missing window.dbMod" -ForegroundColor Red
}

if ($configContent -match 'window\.authMod') {
  $successes += "✅ firebase-config.js exposes window.authMod"
  Write-Host "✅ firebase-config.js exposes window.authMod" -ForegroundColor Green
} else {
  $errors += "❌ firebase-config.js missing window.authMod"
  Write-Host "❌ firebase-config.js missing window.authMod" -ForegroundColor Red
}

Write-Host ""

# Check login.html has auth methods
Write-Host "🔑 Checking login.html..." -ForegroundColor Yellow
$loginContent = Get-Content login.html -Raw
if ($loginContent -match 'signInWithEmailAndPassword') {
  $successes += "✅ login.html has email/password auth"
  Write-Host "✅ login.html has email/password auth" -ForegroundColor Green
} else {
  $errors += "❌ login.html missing email/password auth"
  Write-Host "❌ login.html missing email/password auth" -ForegroundColor Red
}

if ($loginContent -match 'GoogleAuthProvider') {
  $successes += "✅ login.html has Google OAuth"
  Write-Host "✅ login.html has Google OAuth" -ForegroundColor Green
} else {
  $errors += "❌ login.html missing Google OAuth"
  Write-Host "❌ login.html missing Google OAuth" -ForegroundColor Red
}

if ($loginContent -match 'Continue as Guest') {
  $successes += "✅ login.html has guest mode"
  Write-Host "✅ login.html has guest mode" -ForegroundColor Green
} else {
  $errors += "❌ login.html missing guest mode"
  Write-Host "❌ login.html missing guest mode" -ForegroundColor Red
}

Write-Host ""

# Check index.html has auth gate
Write-Host "🔐 Checking index.html..." -ForegroundColor Yellow
$indexContent = Get-Content index.html -Raw
if ($indexContent -match 'onAuthStateChanged') {
  $successes += "✅ index.html has auth gate"
  Write-Host "✅ index.html has auth gate" -ForegroundColor Green
} else {
  $errors += "❌ index.html missing auth gate"
  Write-Host "❌ index.html missing auth gate" -ForegroundColor Red
}

if ($indexContent -match 'ourshow_guest') {
  $successes += "✅ index.html checks guest mode"
  Write-Host "✅ index.html checks guest mode" -ForegroundColor Green
} else {
  $errors += "❌ index.html doesn't check guest mode"
  Write-Host "❌ index.html doesn't check guest mode" -ForegroundColor Red
}

if ($indexContent -match 'post\.html.*opacity') {
  $successes += "✅ index.html gates Posts feature"
  Write-Host "✅ index.html gates Posts feature" -ForegroundColor Green
} else {
  $warnings += "⚠️  index.html may not fully gate Posts feature"
  Write-Host "⚠️  index.html may not fully gate Posts feature" -ForegroundColor Yellow
}

Write-Host ""

# Check community.html loads firebase-config
Write-Host "💬 Checking community.html..." -ForegroundColor Yellow
$communityHtmlContent = Get-Content community.html -Raw
if ($communityHtmlContent -match 'firebase-config\.js') {
  $successes += "✅ community.html loads firebase-config.js"
  Write-Host "✅ community.html loads firebase-config.js" -ForegroundColor Green
} else {
  $errors += "❌ community.html doesn't load firebase-config.js"
  Write-Host "❌ community.html doesn't load firebase-config.js" -ForegroundColor Red
}

if ($communityHtmlContent -match 'type="module"') {
  $successes += "✅ community.html uses type=module"
  Write-Host "✅ community.html uses type=module" -ForegroundColor Green
} else {
  $errors += "❌ community.html script not type=module"
  Write-Host "❌ community.html script not type=module" -ForegroundColor Red
}

Write-Host ""

# Check community.js imports modular SDK
Write-Host "💭 Checking community.js..." -ForegroundColor Yellow
$communityJsContent = Get-Content community.js -Raw
if ($communityJsContent -match 'firebase-database\.js') {
  $successes += "✅ community.js imports modular database API"
  Write-Host "✅ community.js imports modular database API" -ForegroundColor Green
} else {
  $errors += "❌ community.js missing modular database import"
  Write-Host "❌ community.js missing modular database import" -ForegroundColor Red
}

if ($communityJsContent -match 'window\.dbMod') {
  $successes += "✅ community.js uses window.dbMod"
  Write-Host "✅ community.js uses window.dbMod" -ForegroundColor Green
} else {
  $errors += "❌ community.js doesn't use window.dbMod"
  Write-Host "❌ community.js doesn't use window.dbMod" -ForegroundColor Red
}

if ($communityJsContent -match 'console\.log.*window\.dbMod') {
  $successes += "✅ community.js has debug logging"
  Write-Host "✅ community.js has debug logging" -ForegroundColor Green
} else {
  $warnings += "⚠️  community.js may not have enough debug logging"
  Write-Host "⚠️  community.js may not have enough debug logging" -ForegroundColor Yellow
}

Write-Host ""

# Check post.html and post.js
Write-Host "📝 Checking post.html/post.js..." -ForegroundColor Yellow
$postHtmlContent = Get-Content post.html -Raw
if ($postHtmlContent -match 'auth-notice') {
  $successes += "✅ post.html has auth notice for guests"
  Write-Host "✅ post.html has auth notice for guests" -ForegroundColor Green
} else {
  $warnings += "⚠️  post.html may not have auth notice"
  Write-Host "⚠️  post.html may not have auth notice" -ForegroundColor Yellow
}

$postJsContent = Get-Content post.js -Raw
if ($postJsContent -match 'firebase-auth\.js') {
  $successes += "✅ post.js imports modular auth"
  Write-Host "✅ post.js imports modular auth" -ForegroundColor Green
} else {
  $errors += "❌ post.js missing modular auth import"
  Write-Host "❌ post.js missing modular auth import" -ForegroundColor Red
}

if ($postJsContent -match 'onAuthStateChanged') {
  $successes += "✅ post.js checks auth state"
  Write-Host "✅ post.js checks auth state" -ForegroundColor Green
} else {
  $errors += "❌ post.js doesn't check auth state"
  Write-Host "❌ post.js doesn't check auth state" -ForegroundColor Red
}

Write-Host ""

# Summary
Write-Host "`n📊 Summary" -ForegroundColor Cyan
Write-Host "==========" -ForegroundColor Cyan
Write-Host "✅ Successes: $($successes.Count)" -ForegroundColor Green
Write-Host "⚠️  Warnings: $($warnings.Count)" -ForegroundColor Yellow
Write-Host "❌ Errors: $($errors.Count)" -ForegroundColor Red

if ($errors.Count -eq 0 -and $warnings.Count -eq 0) {
  Write-Host "`n🎉 All checks passed! Setup is ready." -ForegroundColor Green
  exit 0
} elseif ($errors.Count -eq 0) {
  Write-Host "`n⚠️  Setup complete with warnings. Please review above." -ForegroundColor Yellow
  exit 0
} else {
  Write-Host "`n❌ Setup has errors. Please fix above issues." -ForegroundColor Red
  exit 1
}

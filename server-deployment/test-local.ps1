param(
    [switch]$ResetData
)

$ErrorActionPreference = 'Stop'

$dockerExe = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe"
$deploymentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$composeFile = Join-Path $deploymentDir 'docker-compose.server.yml'
$testComposeFile = Join-Path $deploymentDir 'docker-compose.local-test.yml'
$envFile = Join-Path $deploymentDir '.env.server'
$logFile = Join-Path $deploymentDir 'test-local.log'

if (-not (Test-Path -LiteralPath $dockerExe)) {
    throw "Docker CLI was not found at: $dockerExe"
}

$env:IMAGE_TAG = 'superadmin-local-test'
$env:BIND_IP = '127.0.0.1'
$env:FRONTEND_PORT = '3200'
$env:BACKEND_PORT = '4200'
$env:PUBLIC_APP_URL = 'http://localhost:3200'
$env:PUBLIC_API_URL = 'http://localhost:4200'

Start-Transcript -LiteralPath $logFile -Force
Push-Location $deploymentDir
try {
    Write-Host "Docker executable: $dockerExe"
    & $dockerExe version
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker Desktop is not running or the current PowerShell user cannot access Docker Engine.'
    }

    & $dockerExe compose `
        -p apk-superadmin-test `
        --env-file $envFile `
        -f $composeFile `
        -f $testComposeFile `
        config --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Docker Compose validation failed.' }

    if ($ResetData) {
        Write-Host 'Resetting only the isolated apk-superadmin-test data volumes...'
        & $dockerExe compose `
            -p apk-superadmin-test `
            --env-file $envFile `
            -f $composeFile `
            -f $testComposeFile `
            down -v --remove-orphans
        if ($LASTEXITCODE -ne 0) { throw 'Local test data reset failed.' }
    }

    # The demo seeder is a one-shot container. Remove an earlier completed
    # instance so every test run executes the idempotent seed again.
    & $dockerExe compose `
        -p apk-superadmin-test `
        --env-file $envFile `
        -f $composeFile `
        -f $testComposeFile `
        rm -sf demo-seeder

    $composeStarted = $false
    foreach ($buildAttempt in 1..3) {
        Write-Host "Docker Compose build/start attempt $buildAttempt of 3..."
        & $dockerExe compose `
            -p apk-superadmin-test `
            --env-file $envFile `
            -f $composeFile `
            -f $testComposeFile `
            up -d --build --remove-orphans
        if ($LASTEXITCODE -eq 0) {
            $composeStarted = $true
            break
        }
        if ($buildAttempt -lt 3) {
            Write-Warning 'Build failed; Docker registry errors can be temporary. Retrying in 10 seconds...'
            Start-Sleep -Seconds 10
        }
    }
    if (-not $composeStarted) { throw 'Docker Compose build/start failed after 3 attempts.' }

    Write-Host 'Waiting for the idempotent demo-data seed...'
    & $dockerExe compose `
        -p apk-superadmin-test `
        --env-file $envFile `
        -f $composeFile `
        -f $testComposeFile `
        wait demo-seeder
    $demoSeedExitCode = $LASTEXITCODE
    & $dockerExe compose `
        -p apk-superadmin-test `
        --env-file $envFile `
        -f $composeFile `
        -f $testComposeFile `
        logs --no-color demo-seeder
    if ($demoSeedExitCode -ne 0) {
        throw 'Demo data seeding failed.'
    }

    Write-Host 'Waiting for the backend startup seed...'
    $backendReady = $false
    foreach ($attempt in 1..90) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:4200/' -TimeoutSec 3
            if ($response.StatusCode -lt 500) {
                $backendReady = $true
                break
            }
        } catch {
            if ($_.Exception.Response.StatusCode.value__ -eq 404) {
                $backendReady = $true
                break
            }
        }
        Start-Sleep -Seconds 2
    }
    if (-not $backendReady) { throw 'Backend did not become ready within 180 seconds.' }

    & $dockerExe compose `
        -p apk-superadmin-test `
        --env-file $envFile `
        -f $composeFile `
        -f $testComposeFile `
        ps

    Write-Host ''
    Write-Host 'Local test environment is ready:'
    Write-Host 'Frontend: http://localhost:3200/login'
    Write-Host 'Backend:  http://localhost:4200'
}
catch {
    Write-Host ''
    Write-Error "LOCAL TEST FAILED: $($_.Exception.Message)"
    throw
}
finally {
    Pop-Location
    Stop-Transcript
    Write-Host "Full log: $logFile"
}

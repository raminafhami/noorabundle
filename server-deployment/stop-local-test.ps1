$ErrorActionPreference = 'Stop'

$dockerExe = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe"
$deploymentDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Push-Location $deploymentDir
try {
    & $dockerExe compose `
        -p apk-superadmin-test `
        --env-file '.env.server' `
        -f 'docker-compose.server.yml' `
        -f 'docker-compose.local-test.yml' `
        down
}
finally {
    Pop-Location
}

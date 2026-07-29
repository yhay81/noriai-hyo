[CmdletBinding()]
param(
    [switch]$Local
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$SqlPath = Join-Path $PSScriptRoot "product-metrics.sql"
$Wrangler = Join-Path $RepoRoot "node_modules\.bin\wrangler.cmd"
$Target = if ($Local) { "--local" } else { "--remote" }
$Sql = (Get-Content $SqlPath) -join " "

$Output = & $Wrangler d1 execute noriai-hyo $Target --json --command $Sql
if ($LASTEXITCODE -ne 0) {
    throw "D1 metrics query failed with exit code $LASTEXITCODE"
}

$Payload = ($Output -join [Environment]::NewLine) | ConvertFrom-Json
$Row = $Payload[0].results[0]
if (-not $Row) {
    throw "D1 metrics query returned no result"
}

function Get-Percent {
    param([int]$Numerator, [int]$Denominator)
    if ($Denominator -eq 0) { return $null }
    return [Math]::Round(($Numerator / $Denominator) * 100, 1)
}

$Users = [int]$Row.users
$Events = [int]$Row.events_created
$WithResponses = [int]$Row.events_with_responses
$WithCarpool = [int]$Row.events_with_carpool

[ordered]@{
    generated_at = (Get-Date).ToUniversalTime().ToString("o")
    service = "noriai-hyo"
    environment = if ($Local) { "local" } else { "production" }
    funnel = [ordered]@{
        users = $Users
        organizers = [int]$Row.organizers
        events_created = $Events
        links_copied = [int]$Row.links_copied
        owner_opened = [int]$Row.owner_opened
        responses_saved = [int]$Row.responses_saved
        respondents = [int]$Row.respondents
        events_with_responses = $WithResponses
        events_with_five_responses = [int]$Row.events_with_five_responses
        events_with_carpool = $WithCarpool
        seats_offered = [int]$Row.seats_offered
        rides_needed = [int]$Row.rides_needed
        events_closed = [int]$Row.events_closed
        repeat_organizers = [int]$Row.repeat_organizers
        returned = [int]$Row.returned
        users_7d = [int]$Row.users_7d
        events_7d = [int]$Row.events_7d
    }
    rates = [ordered]@{
        creation_percent = Get-Percent $Events $Users
        first_response_percent = Get-Percent $WithResponses $Events
        carpool_percent = Get-Percent $WithCarpool $Events
    }
} | ConvertTo-Json -Depth 4

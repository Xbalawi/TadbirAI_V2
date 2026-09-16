<#
Writes a local invoice_extractor\.env file with the provided API key.
WARNING: This writes the API key in plain text to a file in the repo folder. Ensure
you do not commit the file. Use this only for local testing.
#>
param([Parameter(Mandatory=$true)][string]$Key)

$envPath = Join-Path -Path $PSScriptRoot -ChildPath '.env'
"GEMINI_API_KEY=$Key" | Out-File -FilePath $envPath -Encoding UTF8 -Force
Write-Host "Wrote $envPath (DO NOT commit this file; it is ignored by .gitignore)"

param([string]$Key)

if (-not $Key) {
    $secure = Read-Host -AsSecureString "Enter GEMINI_API_KEY (input hidden)"
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    } finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
} else {
    $plain = $Key
}

if (-not $plain) {
    Write-Error "No key provided. Aborting."
    exit 1
}

# Set in current session only (won't persist).
$env:GEMINI_API_KEY = $plain
Write-Host "GEMINI_API_KEY set for current session."

param([string]$OAuthJsonPath)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskConfig = Join-Path $taskRoot '.wrangler/nur-accounts.json'
if (-not (Test-Path -LiteralPath $taskConfig)) { throw 'Executez npm run accounts:prepare avant de configurer les secrets.' }
$taskWrangler = Join-Path $taskRoot 'node_modules/wrangler/bin/wrangler.js'
$taskNode = (Get-Command node).Source

function Invoke-NurWrangler([string[]]$Arguments, [string]$SecretValue) {
    $taskStart = New-Object System.Diagnostics.ProcessStartInfo
    $taskStart.FileName = $taskNode
    $taskStart.Arguments = '"' + $taskWrangler + '" ' + ($Arguments -join ' ') + ' --config "' + $taskConfig + '"'
    $taskStart.WorkingDirectory = $taskRoot
    $taskStart.UseShellExecute = $false
    $taskStart.CreateNoWindow = $true
    $taskStart.RedirectStandardInput = $true
    $taskStart.RedirectStandardOutput = $true
    $taskStart.RedirectStandardError = $true
    $taskStart.EnvironmentVariables['WRANGLER_WRITE_LOGS'] = 'false'
    $taskProcess = New-Object System.Diagnostics.Process
    $taskProcess.StartInfo = $taskStart
    [void]$taskProcess.Start()
    $taskOut = $taskProcess.StandardOutput.ReadToEndAsync()
    $taskErr = $taskProcess.StandardError.ReadToEndAsync()
    if ($null -ne $SecretValue) { $taskProcess.StandardInput.WriteLine($SecretValue) }
    $taskProcess.StandardInput.Close()
    $taskProcess.WaitForExit()
    # Never print provider output: it may contain sensitive configuration.
    if ($taskProcess.ExitCode -ne 0) { throw 'Cloudflare a refuse cette etape. Verifiez votre connexion, le compte et les droits du Worker.' }
    return $taskOut.GetAwaiter().GetResult()
}
function Read-NurSecret([string]$Prompt, [int]$MinLength = 1) {
    $taskSecure = Read-Host $Prompt -AsSecureString
    $taskPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecure)
    try { $taskPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPointer); $taskSecure.Dispose() }
    if ($taskPlain.Length -lt $MinLength -or $taskPlain.Length -gt 200) { throw "Longueur requise : $MinLength a 200 caracteres." }
    return $taskPlain
}
function Convert-NurBase64([byte[]]$Bytes) { return [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+','-').Replace('/','_') }
function New-NurHash([string]$Value) {
    $taskSalt = New-Object byte[] 16
    $taskRng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $taskRng.GetBytes($taskSalt) } finally { $taskRng.Dispose() }
    $taskDeriver = [Security.Cryptography.Rfc2898DeriveBytes]::new($Value, $taskSalt, 100000, [Security.Cryptography.HashAlgorithmName]::SHA256)
    try { $taskDigest = $taskDeriver.GetBytes(32) } finally { $taskDeriver.Dispose() }
    return 'pbkdf2$100000$' + (Convert-NurBase64 $taskSalt) + '$' + (Convert-NurBase64 $taskDigest)
}
function Set-NurSecret([string]$Name, [string]$Value) {
    [void](Invoke-NurWrangler @('secret','put',$Name) $Value)
    Write-Host "$Name configure (valeur masquee)."
}

Write-Host 'Les valeurs restent masquees, ne sont pas ecrites dans Git et sont envoyees directement a Cloudflare.'
$taskExisting = @(ConvertFrom-Json (Invoke-NurWrangler @('secret','list') $null))
if (-not ($taskExisting | Where-Object { $_.name -eq 'AUTH_SECRET' })) {
    $taskBytes = New-Object byte[] 48
    $taskRng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $taskRng.GetBytes($taskBytes) } finally { $taskRng.Dispose() }
    Set-NurSecret 'AUTH_SECRET' (Convert-NurBase64 $taskBytes)
} else { Write-Host 'AUTH_SECRET existant conserve pour ne pas invalider les sessions et le jeton Gmail.' }

if ($OAuthJsonPath) {
    $taskOAuth = (Get-Content -LiteralPath $OAuthJsonPath -Raw | ConvertFrom-Json).web
    if (-not $taskOAuth.client_id -or -not $taskOAuth.client_secret) { throw 'Le JSON doit etre celui du client OAuth Application Web.' }
    Set-NurSecret 'GOOGLE_CLIENT_ID' $taskOAuth.client_id
    Set-NurSecret 'GOOGLE_CLIENT_SECRET' $taskOAuth.client_secret
    $taskOAuth = $null
} else {
    $taskClientId = Read-Host 'Identifiant OAuth Google (client ID, ou Entree pour configurer Google plus tard)'
    if ($taskClientId) {
        Set-NurSecret 'GOOGLE_CLIENT_ID' $taskClientId
        Set-NurSecret 'GOOGLE_CLIENT_SECRET' (Read-NurSecret 'Secret du client OAuth Google')
    }
}
$taskAdmin = Read-Host 'Identifiant du seul administrateur'
if (-not $taskAdmin -or $taskAdmin.Length -gt 100) { throw 'Identifiant requis (100 caracteres maximum).' }
$taskPassword = Read-NurSecret 'NOUVEAU mot de passe admin (minimum 14 caracteres, ne reutilisez pas celui du chat)' 14
$taskConfirm = Read-NurSecret 'Confirmez ce mot de passe' 14
if ($taskPassword -cne $taskConfirm) { throw 'La confirmation ne correspond pas.' }
$taskPin = Read-NurSecret 'NOUVEAU code secret admin (minimum 6 caracteres)' 6
$taskAnswer1 = (Read-NurSecret 'Reponse : de quelle ville viens-tu ?' 3).Normalize([Text.NormalizationForm]::FormKC).Trim().ToLowerInvariant()
$taskAnswer2 = (Read-NurSecret 'Reponse : quel etait le nom de ton chien ?' 3).Normalize([Text.NormalizationForm]::FormKC).Trim().ToLowerInvariant()
$taskAnswer3 = (Read-NurSecret 'Reponse : quel est ton youtubeur prefere ?' 3).Normalize([Text.NormalizationForm]::FormKC).Trim().ToLowerInvariant()
Set-NurSecret 'ADMIN_USERNAME' $taskAdmin
Set-NurSecret 'ADMIN_PASSWORD_HASH' (New-NurHash $taskPassword)
Set-NurSecret 'ADMIN_PIN_HASH' (New-NurHash $taskPin)
Set-NurSecret 'ADMIN_ANSWER_1_HASH' (New-NurHash $taskAnswer1)
Set-NurSecret 'ADMIN_ANSWER_2_HASH' (New-NurHash $taskAnswer2)
Set-NurSecret 'ADMIN_ANSWER_3_HASH' (New-NurHash $taskAnswer3)
$taskPassword = $taskConfirm = $taskPin = $taskAnswer1 = $taskAnswer2 = $taskAnswer3 = $null
Write-Host 'Secrets prepares. Apres publication, ouvrez /admin puis Autoriser Gmail avec le compte support.nurquran@gmail.com.'

[CmdletBinding()]
param(
    [switch]$Plan,
    [switch]$Apply,
    [ValidatePattern('^[a-z][a-z0-9-]{4,28}[a-z0-9]$')]
    [string]$Project = 'keepcoodingoee',
    [ValidatePattern('^[a-z]+-[a-z]+[0-9]+$')]
    [string]$Region = 'us-central1',
    [ValidatePattern('^[a-z]+-[a-z]+[0-9]+-[a-z]$')]
    [string]$Zone = 'us-central1-a',
    [ValidatePattern('^[a-z][a-z0-9-]{0,48}[a-z0-9]$')]
    [string]$VmName = 'oee-demo',
    [string]$GcloudPath
)

$ErrorActionPreference = 'Stop'
if ($Plan -and $Apply) { throw 'Use -Plan or -Apply, not both.' }
if (-not $Zone.StartsWith("$Region-")) { throw 'Zone must belong to Region.' }
if (-not $env:CLOUDSDK_CONFIG -and $env:LOCALAPPDATA) {
    $env:CLOUDSDK_CONFIG = Join-Path $env:LOCALAPPDATA 'OeeLiveTools/gcloud-config'
}
if (-not $env:CLOUDSDK_PYTHON) {
    $localPython = Join-Path $PSScriptRoot '../../backend/.venv/Scripts/python.exe'
    if (Test-Path -LiteralPath $localPython) { $env:CLOUDSDK_PYTHON = (Resolve-Path $localPython).Path }
}
$networkName = "$VmName-network"
$subnetName = "$VmName-subnet"
$addressName = "$VmName-ip"
$webRuleName = "$VmName-web"
$sshRuleName = "$VmName-iap-ssh"
$owner = 'OEE Live exam demo; managed by scripts/gcp/provision.ps1'
$startupFile = Join-Path $PSScriptRoot 'bootstrap-vm.sh'
$startupText = [IO.File]::ReadAllText($startupFile).Replace("`r`n", "`n")
$networkRef = "projects/$Project/global/networks/$networkName"
$subnetRef = "projects/$Project/regions/$Region/subnetworks/$subnetName"
$vmRef = "projects/$Project/zones/$Zone/instances/$VmName"

Write-Host "OEE server: project=$Project zone=$Zone VM=$VmName"
Write-Host 'e2-medium / Debian 12 / 30 GB pd-standard / 2 GB swap / static IPv4'
Write-Host "VPC=$networkName subnet=$subnetName (10.72.0.0/24)"
Write-Host 'Public TCP 80/443, UDP 443; SSH only from IAP 35.235.240.0/20.'
Write-Host 'OS Login enabled; no service account; no app deployment or secrets in metadata.'
if (-not $Apply) { Write-Host 'PLAN: read-only; APIs and resources will not be changed.' }

if (-not $GcloudPath) {
    $command = Get-Command gcloud.cmd, gcloud -CommandType Application -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($command) { $GcloudPath = $command.Source }
    elseif ($env:LOCALAPPDATA) {
        $candidate = Join-Path $env:LOCALAPPDATA 'OeeLiveTools/google-cloud-sdk/bin/gcloud.cmd'
        if (Test-Path -LiteralPath $candidate) { $GcloudPath = $candidate }
    }
}
if (-not $GcloudPath -or -not (Test-Path -LiteralPath $GcloudPath)) {
    if ($Apply) { throw 'gcloud is missing. Install Google Cloud CLI and authenticate first.' }
    Write-Warning 'Local plan only: gcloud is missing; existing resources were not checked.'
    return
}

function Invoke-GcloudJson([string[]]$Arguments) {
    $output = & $GcloudPath @Arguments "--project=$Project" '--quiet' '--format=json'
    if ($LASTEXITCODE -ne 0) { throw "gcloud failed ($LASTEXITCODE): $($Arguments[0..1] -join ' ')" }
    $text = $output -join "`n"
    if ($text.Trim()) { return ($text | ConvertFrom-Json) }
}

function Assert-Resource([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "Preflight refused: $Message. No existing resource will be changed." }
}

function Same-Set($Actual, $Expected) {
    return (($Actual | Sort-Object) -join '|') -ceq (($Expected | Sort-Object) -join '|')
}

function Own-Resource($Resource) {
    Assert-Resource ($Resource.description -ceq $owner) "foreign resource $($Resource.name)"
}

function Find-One([string[]]$Arguments, [string]$Name) {
    $rows = @(Invoke-GcloudJson ($Arguments + "--filter=name=$Name"))
    Assert-Resource ($rows.Count -le 1) "ambiguous resource name $Name across locations"
    if ($rows.Count) { return $rows[0] }
}

function Check-Firewall($Rule, [string[]]$Sources, [string[]]$Ports) {
    if (-not $Rule) { return }
    Own-Resource $Rule
    $actualPorts = @($Rule.allowed | ForEach-Object {
        $protocol = $_.IPProtocol
        if ($_.ports) { $_.ports | ForEach-Object { "${protocol}:$_" } }
        else { "${protocol}:all" }
    })
    Assert-Resource ($Rule.network.EndsWith($networkRef) -and $Rule.direction -eq 'INGRESS' -and
        $Rule.priority -eq 1000 -and -not $Rule.disabled -and -not $Rule.denied -and
        (Same-Set $Rule.sourceRanges $Sources) -and (Same-Set $actualPorts $Ports) -and
        (Same-Set $Rule.targetTags @($VmName)) -and -not $Rule.sourceTags -and
        -not $Rule.sourceServiceAccounts -and -not $Rule.targetServiceAccounts) "firewall mismatch $($Rule.name)"
}

$accounts = @(Invoke-GcloudJson @('auth', 'list', '--filter=status:ACTIVE'))
if ($accounts.Count -ne 1) {
    if ($Apply) { throw 'Authenticate with gcloud auth login before using -Apply.' }
    Write-Warning 'Local plan only: no active account; existing resources were not checked.'
    return
}
$enabled = @(Invoke-GcloudJson @('services', 'list', '--enabled'))
$neededApis = @('compute.googleapis.com', 'iap.googleapis.com', 'oslogin.googleapis.com')
$missingApis = @($neededApis | Where-Object { $_ -notin $enabled.config.name })
if ($missingApis) { Write-Host "APIs required: $($missingApis -join ', ')" }
if ('compute.googleapis.com' -in $missingApis) {
    if (-not $Apply) {
        Write-Host 'Compute API is disabled; resource inventory cannot be checked. Nothing was enabled.'
        return
    }
    Invoke-GcloudJson (@('services', 'enable') + $missingApis) | Out-Null
    $missingApis = @()
}

# Inspect every existing resource before the first resource creation.
$network = Find-One @('compute', 'networks', 'list') $networkName
$subnet = Find-One @('compute', 'networks', 'subnets', 'list') $subnetName
$address = Find-One @('compute', 'addresses', 'list') $addressName
$vm = Find-One @('compute', 'instances', 'list') $VmName
$disk = Find-One @('compute', 'disks', 'list') $VmName
$firewalls = @(Invoke-GcloudJson @('compute', 'firewall-rules', 'list'))
$webRule = $firewalls | Where-Object name -eq $webRuleName
$sshRule = $firewalls | Where-Object name -eq $sshRuleName
if ($network) {
    Own-Resource $network
    Assert-Resource (-not $network.autoCreateSubnetworks -and
        $network.routingConfig.routingMode -eq 'REGIONAL') 'network mode mismatch'
    $foreignRules = @($firewalls | Where-Object {
        $_.network.EndsWith($networkRef) -and $_.name -notin @($webRuleName, $sshRuleName)
    })
    Assert-Resource ($foreignRules.Count -eq 0) 'unexpected firewall rules in the dedicated network'
    Assert-Resource (@($network.subnetworks | Where-Object {
        -not $_.EndsWith($subnetRef)
    }).Count -eq 0) 'unexpected subnetworks in the dedicated network'
}
if ($subnet) {
    Own-Resource $subnet
    Assert-Resource ($subnet.network.EndsWith($networkRef) -and $subnet.region.EndsWith("/$Region") -and
        $subnet.ipCidrRange -eq '10.72.0.0/24' -and $subnet.stackType -eq 'IPV4_ONLY' -and
        -not $subnet.secondaryIpRanges) 'subnetwork mismatch'
}
if ($address) {
    Own-Resource $address
    $parsedAddress = $null
    $validIPv4 = [System.Net.IPAddress]::TryParse($address.address, [ref]$parsedAddress) -and
        $parsedAddress.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork
    Assert-Resource ($address.region.EndsWith("/$Region") -and $address.addressType -eq 'EXTERNAL' -and
        $address.networkTier -eq 'PREMIUM' -and $validIPv4 -and
        (-not $address.ipVersion -or $address.ipVersion -eq 'IPV4')) 'static address mismatch'
    Assert-Resource (@($address.users | Where-Object { -not $_.EndsWith($vmRef) }).Count -eq 0) 'static address used by another resource'
}
Check-Firewall $webRule @('0.0.0.0/0') @('tcp:80', 'tcp:443', 'udp:443')
Check-Firewall $sshRule @('35.235.240.0/20') @('tcp:22')
if ($vm) {
    Own-Resource $vm
    $metadata = @{}
    foreach ($item in $vm.metadata.items) { $metadata[$item.key] = $item.value }
    Assert-Resource ($vm.zone.EndsWith("/$Zone") -and $vm.machineType.EndsWith('/e2-medium') -and
        $vm.labels.'managed-by' -eq 'oee-live' -and -not $vm.serviceAccounts -and
        -not $vm.canIpForward -and (Same-Set $vm.tags.items @($VmName)) -and
        $metadata['enable-oslogin'] -eq 'TRUE' -and $metadata['block-project-ssh-keys'] -eq 'TRUE' -and
        $metadata['startup-script'] -and
        $metadata['startup-script'].Replace("`r`n", "`n") -ceq $startupText) 'VM specification or startup script mismatch'
    Assert-Resource (@($vm.networkInterfaces).Count -eq 1 -and
        $vm.networkInterfaces[0].network.EndsWith($networkRef) -and
        $vm.networkInterfaces[0].subnetwork.EndsWith($subnetRef) -and
        @($vm.networkInterfaces[0].accessConfigs).Count -eq 1 -and $address -and
        $vm.networkInterfaces[0].accessConfigs[0].natIP -eq $address.address) 'VM network/address mismatch'
    Assert-Resource ($disk -and @($vm.disks).Count -eq 1 -and $vm.disks[0].boot -and
        $vm.disks[0].source.EndsWith("/zones/$Zone/disks/$VmName") -and
        $disk.zone.EndsWith("/$Zone") -and $disk.type.EndsWith('/pd-standard') -and
        [int]$disk.sizeGb -eq 30 -and
        $disk.sourceImage -match '/projects/debian-cloud/global/images/debian-12-') 'boot disk mismatch'
}
elseif ($disk) { throw 'Preflight refused: an existing disk has the VM name; it will not be reused or deleted.' }

foreach ($entry in @(
    @{Name=$networkName; Resource=$network}, @{Name=$subnetName; Resource=$subnet},
    @{Name=$addressName; Resource=$address}, @{Name=$webRuleName; Resource=$webRule},
    @{Name=$sshRuleName; Resource=$sshRule}, @{Name=$VmName; Resource=$vm}
)) {
    $action = if ($entry.Resource) { 'keep (validated)' } else { 'create' }
    Write-Host "$($entry.Name): $action"
}
if (-not $Apply) { return }
if ($missingApis) { Invoke-GcloudJson (@('services', 'enable') + $missingApis) | Out-Null }
if (-not $network) {
    Invoke-GcloudJson @('compute', 'networks', 'create', $networkName, '--subnet-mode=custom',
        '--bgp-routing-mode=regional', "--description=$owner") | Out-Null
}
if (-not $subnet) {
    Invoke-GcloudJson @('compute', 'networks', 'subnets', 'create', $subnetName,
        "--network=$networkName", "--region=$Region", '--range=10.72.0.0/24',
        '--stack-type=IPV4_ONLY', "--description=$owner") | Out-Null
}
if (-not $address) {
    Invoke-GcloudJson @('compute', 'addresses', 'create', $addressName, "--region=$Region",
        '--network-tier=PREMIUM', "--description=$owner") | Out-Null
    $address = Invoke-GcloudJson @('compute', 'addresses', 'describe', $addressName, "--region=$Region")
}
if (-not $webRule) {
    Invoke-GcloudJson @('compute', 'firewall-rules', 'create', $webRuleName,
        "--network=$networkName", '--direction=INGRESS', '--priority=1000', '--action=ALLOW',
        '--rules=tcp:80,tcp:443,udp:443', '--source-ranges=0.0.0.0/0',
        "--target-tags=$VmName", "--description=$owner") | Out-Null
}
if (-not $sshRule) {
    Invoke-GcloudJson @('compute', 'firewall-rules', 'create', $sshRuleName,
        "--network=$networkName", '--direction=INGRESS', '--priority=1000', '--action=ALLOW',
        '--rules=tcp:22', '--source-ranges=35.235.240.0/20',
        "--target-tags=$VmName", "--description=$owner") | Out-Null
}
if (-not $vm) {
    Invoke-GcloudJson @('compute', 'instances', 'create', $VmName, "--zone=$Zone",
        '--machine-type=e2-medium', '--image-family=debian-12', '--image-project=debian-cloud',
        '--boot-disk-size=30GB', '--boot-disk-type=pd-standard', "--boot-disk-device-name=$VmName",
        "--network=$networkName", "--subnet=$subnetName", "--address=$($address.address)",
        '--network-tier=PREMIUM', "--tags=$VmName", '--no-service-account', '--no-scopes',
        '--metadata=enable-oslogin=TRUE,block-project-ssh-keys=TRUE',
        "--metadata-from-file=startup-script=$startupFile", '--labels=managed-by=oee-live,purpose=exam-demo',
        "--description=$owner") | Out-Null
}
Write-Host "Reserved IP: $($address.address)"
Write-Host 'Server resources are ready; bootstrap completion must be checked over IAP.'
Write-Host "gcloud compute ssh $VmName --project=$Project --zone=$Zone --tunnel-through-iap"

param(
    [string]$ApiBase = "http://127.0.0.1:28080/v1",
    [string]$ApiKey = $env:DOKI_IMAGE_API_KEY,
    [string]$SetName = "soft-cat",
    [string[]]$Actions = @("idle", "pet", "eat", "play", "sleep"),
    [string]$Model = "gpt-image-2",
    [string]$Quality = "medium",
    [string]$Size = "1024x1024"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if (-not $ApiKey) {
    throw "Missing API key. Pass -ApiKey or set DOKI_IMAGE_API_KEY."
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$assetRoot = Join-Path $repoRoot "assets\doki\generated"
$setRoot = Join-Path $assetRoot $SetName

$actionSpecs = @{
    idle = @{
        total = 4
        fps = 6
        note = "sitting calmly, gentle breathing, tiny body squash and stretch, looking forward"
    }
    pet = @{
        total = 4
        fps = 7
        note = "being gently petted, happy closed eyes, rosy cheeks, delighted smile, small head tilt"
    }
    eat = @{
        total = 4
        fps = 7
        note = "eating from a tiny food bowl, cute focused face, small paws near bowl, happy and cozy"
    }
    play = @{
        total = 4
        fps = 8
        note = "playing with a small pink yarn ball, lively curious pose, cheerful face, soft paw reaching toward the ball"
    }
    sleep = @{
        total = 4
        fps = 5
        note = "sleeping on a small soft cushion, relaxed curled pose, closed eyes, peaceful tiny smile, subtle breathing"
    }
}

function Get-DokiFramePrompt {
    param(
        [string]$Action,
        [int]$Index,
        [int]$Total,
        [string]$Note
    )

    return @"
Create frame $Index of $Total for the '$Action' animation of Doki, a kawaii chibi kitten virtual pet.
Style must closely follow the reference sheet: plush 3D toy-like kitten, cream and light beige tabby fur, oversized glossy dark brown eyes with white highlights, tiny pink nose, rosy cheeks, small smiling mouth, soft rounded paws, gold bell collar, warm off-white mobile app background.
Pose/action: $Note. This is one animation keyframe, so keep character identity, camera angle, size, and centered composition consistent across frames.
Single centered full-body kitten, front or slight 3/4 view, generous padding, no text, no watermark, no border, no extra characters, no cropped body parts, avoid hard shadows and busy background details.
"@
}

function Save-GeneratedImage {
    param(
        [object]$Response,
        [string]$OutFile
    )

    $item = $Response.data[0]
    $b64 = $item.b64_json
    if (-not $b64) { $b64 = $item.image_base64 }
    if (-not $b64) { $b64 = $item.result }
    if (-not $b64) { $b64 = $item.image }

    if (-not $b64 -and $item.url) {
        Invoke-WebRequest -Uri $item.url -OutFile $OutFile -TimeoutSec 180 | Out-Null
        return
    }

    if ($b64 -match "^data:image/[^;]+;base64,") {
        $b64 = $b64 -replace "^data:image/[^;]+;base64,", ""
    }
    if (-not $b64) {
        throw "Image API did not return image data."
    }

    [IO.File]::WriteAllBytes($OutFile, [Convert]::FromBase64String($b64))
}

function Write-DokiManifest {
    param(
        [string]$Root,
        [string]$CurrentSet,
        [hashtable]$Specs
    )

    $animations = [ordered]@{}
    $currentSetRoot = Join-Path $Root $CurrentSet
    if (Test-Path -LiteralPath $currentSetRoot) {
        Get-ChildItem -LiteralPath $currentSetRoot -Directory | Sort-Object Name | ForEach-Object {
            $action = $_.Name
            $files = Get-ChildItem -LiteralPath $_.FullName -Filter "$action`_*.png" | Sort-Object Name
            if ($files.Count -eq 0) { return }

            $fps = 6
            if ($Specs.ContainsKey($action)) {
                $fps = [int]$Specs[$action].fps
            }

            if ($action -eq "blink") {
                $closedFrame = $files | Where-Object { $_.Name -eq "blink_02.png" } | Select-Object -First 1
                $idleFramePath = Join-Path $currentSetRoot "idle\idle_01.png"
                if (-not $closedFrame -or -not (Test-Path -LiteralPath $idleFramePath)) { return }
                $fps = 12
                $frames = @(
                    "$CurrentSet/idle/idle_01.png",
                    "$CurrentSet/blink/blink_02.png",
                    "$CurrentSet/idle/idle_01.png"
                )
            } else {
                $frames = @($files | ForEach-Object {
                    "$CurrentSet/$action/$($_.Name)"
                })
            }

            $animations[$action] = [ordered]@{
                fps = $fps
                loop = ($action -eq "idle")
                frames = $frames
            }
        }
    }

    $sets = [ordered]@{}
    $sets[$CurrentSet] = [ordered]@{
        name = $CurrentSet
        basePath = "assets/doki/generated/"
        animations = $animations
    }

    $manifest = [ordered]@{
        version = 1
        defaultSet = $CurrentSet
        sets = $sets
    }

    $manifestPath = Join-Path $Root "manifest.json"
    $manifest | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 -Path $manifestPath
}

New-Item -ItemType Directory -Force -Path $setRoot | Out-Null

$generated = @()
foreach ($action in $Actions) {
    if (-not $actionSpecs.ContainsKey($action)) {
        Write-Warning "Unknown action '$action'; skipping."
        continue
    }

    $spec = $actionSpecs[$action]
    $actionDir = Join-Path $setRoot $action
    New-Item -ItemType Directory -Force -Path $actionDir | Out-Null

    for ($index = 1; $index -le [int]$spec.total; $index += 1) {
        $fileName = "{0}_{1:00}.png" -f $action, $index
        $outFile = Join-Path $actionDir $fileName
        if (Test-Path -LiteralPath $outFile) {
            $generated += "exists $SetName/$action/$fileName"
            continue
        }

        $prompt = Get-DokiFramePrompt -Action $action -Index $index -Total ([int]$spec.total) -Note $spec.note
        $body = @{
            model = $Model
            prompt = $prompt
            size = $Size
            quality = $Quality
            n = 1
        } | ConvertTo-Json -Depth 8

        $response = Invoke-RestMethod `
            -Method Post `
            -Uri "$ApiBase/images/generations" `
            -Headers @{ Authorization = "Bearer $ApiKey"; "Content-Type" = "application/json" } `
            -Body $body `
            -TimeoutSec 180

        Save-GeneratedImage -Response $response -OutFile $outFile
        $sizeBytes = (Get-Item -LiteralPath $outFile).Length
        $generated += "generated $SetName/$action/$fileName ($sizeBytes bytes)"
    }
}

Write-DokiManifest -Root $assetRoot -CurrentSet $SetName -Specs $actionSpecs
$generated
Get-Content -Encoding UTF8 (Join-Path $assetRoot "manifest.json")

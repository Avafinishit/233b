param(
    [string]$ApiBase = "http://127.0.0.1:28080/v1",
    [string]$ApiKey = $env:DOKI_IMAGE_API_KEY,
    [string]$Model = "gpt-image-2",
    [string]$Size = "1024x1024",
    [string]$ReferenceImage = "assets/doki/generated/soft-cat/idle/idle_01.png",
    [string]$OutDir = "assets/doki/generated/soft-cat/pet"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if (-not $ApiKey) {
    throw "Missing API key. Pass -ApiKey or set DOKI_IMAGE_API_KEY."
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$referencePath = Join-Path $repoRoot $ReferenceImage
$outputDirPath = Join-Path $repoRoot $OutDir
New-Item -ItemType Directory -Force -Path $outputDirPath | Out-Null

function Get-DokiPetPrompt {
    param(
        [int]$FrameIndex,
        [string]$MotionNote
    )

    return @"
Edit the provided Doki kitten image into frame $FrameIndex of 3 for a gentle petting animation.
Keep the exact same kitten identity, body shape, cream and beige tabby markings, bell collar, camera angle, scale, centered framing, soft 3D plush style, and warm off-white app background.
Only add one natural soft human hand entering from the upper right, gently touching the top of the kitten's head between the ears. The hand must look like a real softly rendered hand/fingers, not an icon, not a flat sticker, not a blob, not a mitten, not a floating object, not a hat.
Motion for this frame: $MotionNote
The hand should be small enough for a cute mobile pet UI, lightly in contact with the fur, with no hard shadow and no extra objects. Keep the kitten centered with full body visible and generous padding.
No text, no watermark, no border, no extra characters, no cropped kitten body parts, no orange background.
"@
}

function Save-ImageFromResponse {
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

function Invoke-ImageEdit {
    param(
        [string]$Prompt,
        [string]$OutFile
    )

    Add-Type -AssemblyName System.Net.Http
    $client = [System.Net.Http.HttpClient]::new()
    $client.Timeout = [TimeSpan]::FromSeconds(180)
    $client.DefaultRequestHeaders.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $ApiKey)

    $form = [System.Net.Http.MultipartFormDataContent]::new()
    $form.Add([System.Net.Http.StringContent]::new($Model), "model")
    $form.Add([System.Net.Http.StringContent]::new($Prompt), "prompt")
    $form.Add([System.Net.Http.StringContent]::new($Size), "size")

    $imageBytes = [IO.File]::ReadAllBytes($referencePath)
    $imageContent = [System.Net.Http.ByteArrayContent]::new($imageBytes)
    $imageContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("image/png")
    $form.Add($imageContent, "image", "doki-reference.png")

    $response = $client.PostAsync("$($ApiBase.TrimEnd('/'))/images/edits", $form).GetAwaiter().GetResult()
    $responseText = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    $client.Dispose()
    $form.Dispose()

    if (-not $response.IsSuccessStatusCode) {
        throw "Image edit failed ($([int]$response.StatusCode)): $responseText"
    }

    $parsed = $responseText | ConvertFrom-Json
    Save-ImageFromResponse -Response $parsed -OutFile $OutFile
}

$frames = @(
    @{ index = 1; note = "the hand has just arrived and lightly touches the top-left area of the kitten's head, fingers relaxed and barely pressing the fur" },
    @{ index = 2; note = "the hand rests gently across the top center of the kitten's head, fingers softly curved, the kitten remains cute and calm" },
    @{ index = 3; note = "the hand has slid slightly toward the upper-right side of the kitten's head, still gently touching the fur with a soft petting motion" }
)

$generated = @()
foreach ($frame in $frames) {
    $fileName = "pet_hand_{0:00}.png" -f [int]$frame.index
    $outFile = Join-Path $outputDirPath $fileName
    $prompt = Get-DokiPetPrompt -FrameIndex ([int]$frame.index) -MotionNote $frame.note
    Invoke-ImageEdit -Prompt $prompt -OutFile $outFile
    $generated += "$OutDir/$fileName"
}

$generated

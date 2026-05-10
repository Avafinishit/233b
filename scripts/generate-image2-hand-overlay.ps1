param(
    [string]$ApiBase = "http://127.0.0.1:28080/v1",
    [string]$ApiKey = $env:DOKI_IMAGE_API_KEY,
    [string]$Model = "gpt-image-2",
    [string]$Quality = "medium",
    [string]$Size = "1024x1024",
    [string]$SourceOut = "assets/doki/generated/soft-cat/pet/image2_hand_source.png",
    [string]$TransparentOut = "assets/doki/generated/soft-cat/pet/image2_hand.png"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if (-not $ApiKey) {
    throw "Missing API key. Pass -ApiKey or set DOKI_IMAGE_API_KEY."
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $repoRoot $SourceOut
$transparentPath = Join-Path $repoRoot $TransparentOut
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $sourcePath) | Out-Null

$prompt = @"
Use case: stylized-concept
Asset type: transparent overlay source for a mobile virtual pet animation
Primary request: create one clean isolated human hand that can gently pet a tiny chibi kitten's head.
Subject: a soft natural human right hand and a short forearm entering from the upper right, palm facing down, index and middle fingers relaxed and slightly curved downward as if lightly stroking the top of a small kitten between the ears.
Style/medium: polished soft 3D illustration, gentle realistic hand anatomy, warm peach skin, cute mobile app mascot asset, clean readable silhouette at small size.
Composition/framing: hand centered with generous padding, forearm exits the right edge naturally, fingers point down-left, no cat, no fur, no objects.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background only.
Constraints: background must be one uniform #00ff00 color with no shadows, gradients, floor, texture, or lighting variation. Do not use green in the hand. No text, no watermark, no border, no extra objects, no kitten, no cropped fingers, no mitten, no blob, no sticker icon.
"@

$body = @{
    model = $Model
    prompt = $prompt
    size = $Size
    quality = $Quality
    n = 1
} | ConvertTo-Json -Depth 8

$response = Invoke-RestMethod `
    -Method Post `
    -Uri "$($ApiBase.TrimEnd('/'))/images/generations" `
    -Headers @{ Authorization = "Bearer $ApiKey"; "Content-Type" = "application/json" } `
    -Body $body `
    -TimeoutSec 180

$item = $response.data[0]
$b64 = $item.b64_json
if (-not $b64) { $b64 = $item.image_base64 }
if (-not $b64) { $b64 = $item.result }
if (-not $b64) { $b64 = $item.image }
if (-not $b64 -and $item.url) {
    Invoke-WebRequest -Uri $item.url -OutFile $sourcePath -TimeoutSec 180 | Out-Null
} else {
    if ($b64 -match "^data:image/[^;]+;base64,") {
        $b64 = $b64 -replace "^data:image/[^;]+;base64,", ""
    }
    if (-not $b64) {
        throw "Image API did not return image data."
    }
    [IO.File]::WriteAllBytes($sourcePath, [Convert]::FromBase64String($b64))
}

Add-Type -AssemblyName System.Drawing

$source = [System.Drawing.Bitmap]::FromFile($sourcePath)
$minX = $source.Width
$minY = $source.Height
$maxX = -1
$maxY = -1
$keep = New-Object 'bool[,]' $source.Width, $source.Height

for ($y = 0; $y -lt $source.Height; $y += 1) {
    for ($x = 0; $x -lt $source.Width; $x += 1) {
        $pixel = $source.GetPixel($x, $y)
        $r = [int]$pixel.R
        $g = [int]$pixel.G
        $b = [int]$pixel.B
        $isGreen = ($g -ge 150 -and $g -gt ($r * 1.45) -and $g -gt ($b * 1.45))
        if (-not $isGreen) {
            $keep[$x, $y] = $true
            if ($x -lt $minX) { $minX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

if ($maxX -lt $minX -or $maxY -lt $minY) {
    $source.Dispose()
    throw "Could not find non-green hand pixels."
}

$pad = 22
$cropX = [Math]::Max(0, $minX - $pad)
$cropY = [Math]::Max(0, $minY - $pad)
$cropRight = [Math]::Min($source.Width - 1, $maxX + $pad)
$cropBottom = [Math]::Min($source.Height - 1, $maxY + $pad)
$cropWidth = $cropRight - $cropX + 1
$cropHeight = $cropBottom - $cropY + 1
$output = [System.Drawing.Bitmap]::new($cropWidth, $cropHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

for ($y = 0; $y -lt $cropHeight; $y += 1) {
    for ($x = 0; $x -lt $cropWidth; $x += 1) {
        $srcX = $cropX + $x
        $srcY = $cropY + $y
        $pixel = $source.GetPixel($srcX, $srcY)
        if ($keep[$srcX, $srcY]) {
            $output.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(240, $pixel.R, $pixel.G, $pixel.B))
        } else {
            $output.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
        }
    }
}

$source.Dispose()
$output.Save($transparentPath, [System.Drawing.Imaging.ImageFormat]::Png)
$output.Dispose()

Write-Output $SourceOut
Write-Output $TransparentOut

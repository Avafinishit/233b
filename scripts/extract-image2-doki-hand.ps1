param(
    [string]$InputPath = "assets/doki/generated/soft-cat/pet/pet_hand_03.png",
    [string]$OutputPath = "assets/doki/generated/soft-cat/pet/image2_hand.png"
)

Add-Type -AssemblyName System.Drawing

$inputFullPath = (Resolve-Path $InputPath).Path
$outputFullPath = Join-Path (Get-Location) $OutputPath
$outputDir = Split-Path -Parent $outputFullPath
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$source = [System.Drawing.Bitmap]::FromFile($inputFullPath)
$cropX = 454
$cropY = 88
$cropWidth = 570
$cropHeight = 222
$output = [System.Drawing.Bitmap]::new($cropWidth, $cropHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

for ($y = 0; $y -lt $cropHeight; $y += 1) {
    for ($x = 0; $x -lt $cropWidth; $x += 1) {
        $srcX = $cropX + $x
        $srcY = $cropY + $y
        $pixel = $source.GetPixel($srcX, $srcY)
        $r = [int]$pixel.R
        $g = [int]$pixel.G
        $b = [int]$pixel.B

        $isLikelySkin = (
            $r -ge 202 -and $g -ge 132 -and $b -ge 104 -and
            ($r - $g) -ge 16 -and
            ($g - $b) -ge 6
        )
        $isBackground = (
            $r -ge 238 -and $g -ge 236 -and $b -ge 236 -and
            [Math]::Abs($r - $g) -le 10 -and
            [Math]::Abs($g - $b) -le 10
        )

        $inHandArea = $false
        if ($srcX -ge 548 -and $srcY -ge 122 -and $srcY -le 232) { $inHandArea = $true }
        if ($srcX -ge 536 -and $srcX -le 676 -and $srcY -ge 168 -and $srcY -le 252) { $inHandArea = $true }
        if ($srcX -ge 676 -and $srcY -ge 166 -and $srcY -le 286) { $inHandArea = $true }

        $isFurFragment = (
            $srcX -lt 620 -and $srcY -gt 206 -and
            $r -ge 206 -and $r -le 245 -and
            $g -ge 142 -and $g -le 200 -and
            $b -ge 90 -and $b -le 150
        )

        if ($isLikelySkin -and -not $isBackground -and -not $isFurFragment -and $inHandArea) {
            $alpha = [Math]::Min(242, [Math]::Max(0, [int]($pixel.A * 0.94)))
            $output.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $pixel.R, $pixel.G, $pixel.B))
        } else {
            $output.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
        }
    }
}

$source.Dispose()
$output.Save($outputFullPath, [System.Drawing.Imaging.ImageFormat]::Png)
$output.Dispose()

Write-Output $OutputPath

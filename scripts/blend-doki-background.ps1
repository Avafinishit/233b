param(
    [string]$TargetColor = "#f5f5f7",
    [string]$SetName = "soft-cat"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Drawing

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

public static class DokiBackgroundBlender
{
    public static void Process(string inputPath, string outputPath, int targetR, int targetG, int targetB)
    {
        using (var input = Image.FromFile(inputPath))
        using (var bitmap = new Bitmap(input.Width, input.Height, PixelFormat.Format24bppRgb))
        {
            using (var graphics = Graphics.FromImage(bitmap))
            {
                graphics.DrawImage(input, 0, 0, input.Width, input.Height);
            }

            int width = bitmap.Width;
            int height = bitmap.Height;
            Color[] samples = new Color[]
            {
                bitmap.GetPixel(0, 0),
                bitmap.GetPixel(width - 1, 0),
                bitmap.GetPixel(0, height - 1),
                bitmap.GetPixel(width - 1, height - 1),
                bitmap.GetPixel(width / 2, 0),
                bitmap.GetPixel(width / 2, height - 1),
                bitmap.GetPixel(0, height / 2),
                bitmap.GetPixel(width - 1, height / 2)
            };

            double bgR = 0, bgG = 0, bgB = 0;
            foreach (var sample in samples)
            {
                bgR += sample.R;
                bgG += sample.G;
                bgB += sample.B;
            }
            bgR /= samples.Length;
            bgG /= samples.Length;
            bgB /= samples.Length;

            var rect = new Rectangle(0, 0, width, height);
            BitmapData data = bitmap.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format24bppRgb);
            int length = Math.Abs(data.Stride) * height;
            byte[] bytes = new byte[length];
            Marshal.Copy(data.Scan0, bytes, 0, length);

            for (int y = 0; y < height; y++)
            {
                int row = y * data.Stride;
                for (int x = 0; x < width; x++)
                {
                    int index = row + (x * 3);
                    int b = bytes[index];
                    int g = bytes[index + 1];
                    int r = bytes[index + 2];

                    double dr = r - bgR;
                    double dg = g - bgG;
                    double db = b - bgB;
                    double distance = Math.Sqrt((dr * dr) + (dg * dg) + (db * db));

                    double amount = 0.0;
                    if (distance < 34.0)
                    {
                        amount = 1.0;
                    }
                    else if (distance < 54.0)
                    {
                        amount = 1.0 - ((distance - 34.0) / 20.0);
                    }

                    if (amount > 0.0)
                    {
                        bytes[index] = Mix(b, targetB, amount);
                        bytes[index + 1] = Mix(g, targetG, amount);
                        bytes[index + 2] = Mix(r, targetR, amount);
                    }
                }
            }

            Marshal.Copy(bytes, 0, data.Scan0, length);
            bitmap.UnlockBits(data);

            string directory = Path.GetDirectoryName(outputPath);
            if (!String.IsNullOrEmpty(directory))
            {
                Directory.CreateDirectory(directory);
            }
            string tempPath = outputPath + ".tmp";
            bitmap.Save(tempPath, ImageFormat.Png);
            if (File.Exists(outputPath))
            {
                File.Delete(outputPath);
            }
            File.Move(tempPath, outputPath);
        }
    }

    private static byte Mix(int from, int to, double amount)
    {
        int value = (int)Math.Round(from + ((to - from) * amount));
        if (value < 0) return 0;
        if (value > 255) return 255;
        return (byte)value;
    }
}
"@

$repoRoot = Split-Path -Parent $PSScriptRoot
$assetRoot = Join-Path $repoRoot "assets\doki\generated"
$setRoot = Join-Path $assetRoot $SetName
$backupRoot = Join-Path $assetRoot "originals\$SetName"

if (-not (Test-Path -LiteralPath $setRoot)) {
    throw "Missing Doki asset set: $setRoot"
}

function Convert-HexColor {
    param([string]$Hex)
    $value = $Hex.Trim().TrimStart("#")
    if ($value.Length -ne 6) {
        throw "TargetColor must be a 6-digit hex color."
    }
    return [System.Drawing.Color]::FromArgb(
        [Convert]::ToInt32($value.Substring(0, 2), 16),
        [Convert]::ToInt32($value.Substring(2, 2), 16),
        [Convert]::ToInt32($value.Substring(4, 2), 16)
    )
}

function Get-ColorDistance {
    param(
        [System.Drawing.Color]$A,
        [System.Drawing.Color]$B
    )
    $dr = [int]$A.R - [int]$B.R
    $dg = [int]$A.G - [int]$B.G
    $db = [int]$A.B - [int]$B.B
    return [Math]::Sqrt(($dr * $dr) + ($dg * $dg) + ($db * $db))
}

function Mix-Channel {
    param(
        [int]$From,
        [int]$To,
        [double]$Amount
    )
    return [Math]::Max(0, [Math]::Min(255, [int][Math]::Round($From + (($To - $From) * $Amount))))
}

function Copy-OriginalIfNeeded {
    param([string]$FilePath)
    $relative = $FilePath.Substring($setRoot.Length).TrimStart("\", "/")
    $backupPath = Join-Path $backupRoot $relative
    if (-not (Test-Path -LiteralPath $backupPath)) {
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $backupPath) | Out-Null
        Copy-Item -LiteralPath $FilePath -Destination $backupPath
    }
}

$target = Convert-HexColor $TargetColor
$files = Get-ChildItem -LiteralPath $setRoot -Recurse -Filter *.png
$processed = @()

foreach ($file in $files) {
    Copy-OriginalIfNeeded -FilePath $file.FullName

    $relative = $file.FullName.Substring($setRoot.Length).TrimStart("\", "/")
    $backupPath = Join-Path $backupRoot $relative
    $sourcePath = if (Test-Path -LiteralPath $backupPath) { $backupPath } else { $file.FullName }
    [DokiBackgroundBlender]::Process($sourcePath, $file.FullName, $target.R, $target.G, $target.B)
    $processed += $file.FullName
}

$processed

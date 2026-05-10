param(
    [string]$SetName = "soft-cat",
    [string[]]$Actions = @("pet", "eat"),
    [double]$BlendAmount = 0.5
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

public static class DokiFrameTweener
{
    public static void Blend(string aPath, string bPath, string outPath, double amount)
    {
        using (var aImage = Image.FromFile(aPath))
        using (var bImage = Image.FromFile(bPath))
        using (var a = new Bitmap(aImage.Width, aImage.Height, PixelFormat.Format24bppRgb))
        using (var b = new Bitmap(aImage.Width, aImage.Height, PixelFormat.Format24bppRgb))
        using (var output = new Bitmap(aImage.Width, aImage.Height, PixelFormat.Format24bppRgb))
        {
            if (aImage.Width != bImage.Width || aImage.Height != bImage.Height)
            {
                throw new InvalidOperationException("Input frames must have the same dimensions.");
            }

            using (var ga = Graphics.FromImage(a))
            using (var gb = Graphics.FromImage(b))
            {
                ga.DrawImage(aImage, 0, 0, aImage.Width, aImage.Height);
                gb.DrawImage(bImage, 0, 0, bImage.Width, bImage.Height);
            }

            var rect = new Rectangle(0, 0, a.Width, a.Height);
            BitmapData dataA = a.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);
            BitmapData dataB = b.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);
            BitmapData dataOut = output.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format24bppRgb);

            int length = Math.Abs(dataA.Stride) * a.Height;
            byte[] bytesA = new byte[length];
            byte[] bytesB = new byte[length];
            byte[] bytesOut = new byte[length];
            Marshal.Copy(dataA.Scan0, bytesA, 0, length);
            Marshal.Copy(dataB.Scan0, bytesB, 0, length);

            double inverse = 1.0 - amount;
            for (int i = 0; i < length; i += 1)
            {
                bytesOut[i] = (byte)Math.Round((bytesA[i] * inverse) + (bytesB[i] * amount));
            }

            Marshal.Copy(bytesOut, 0, dataOut.Scan0, length);
            a.UnlockBits(dataA);
            b.UnlockBits(dataB);
            output.UnlockBits(dataOut);

            string directory = Path.GetDirectoryName(outPath);
            if (!String.IsNullOrEmpty(directory))
            {
                Directory.CreateDirectory(directory);
            }
            string tempPath = outPath + ".tmp";
            output.Save(tempPath, ImageFormat.Png);
            if (File.Exists(outPath))
            {
                File.Delete(outPath);
            }
            File.Move(tempPath, outPath);
        }
    }
}
"@

$repoRoot = Split-Path -Parent $PSScriptRoot
$assetRoot = Join-Path $repoRoot "assets\doki\generated"
$setRoot = Join-Path $assetRoot $SetName
$manifestPath = Join-Path $assetRoot "manifest.json"

if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "Missing Doki manifest: $manifestPath"
}

$manifest = Get-Content -Raw -Encoding UTF8 $manifestPath | ConvertFrom-Json
$generated = @()

foreach ($action in $Actions) {
    $actionDir = Join-Path $setRoot $action
    if (-not (Test-Path -LiteralPath $actionDir)) {
        Write-Warning "Missing action directory: $actionDir"
        continue
    }

    $baseFramePattern = "^" + [Regex]::Escape($action) + "_\d{2}\.png$"
    $baseFrames = Get-ChildItem -LiteralPath $actionDir -Filter "*.png" |
        Where-Object { $_.Name -match $baseFramePattern } |
        Sort-Object Name

    if ($baseFrames.Count -lt 2) {
        Write-Warning "Need at least two base frames for action '$action'."
        continue
    }

    $manifestFrames = New-Object System.Collections.Generic.List[string]
    for ($index = 0; $index -lt $baseFrames.Count; $index += 1) {
        $current = $baseFrames[$index]
        $manifestFrames.Add("$SetName/$action/$($current.Name)")

        if ($index -lt ($baseFrames.Count - 1)) {
            $next = $baseFrames[$index + 1]
            $tweenName = "{0}_{1:00}_{2:00}.png" -f $action, ($index + 1), ($index + 2)
            $tweenPath = Join-Path $actionDir $tweenName
            [DokiFrameTweener]::Blend($current.FullName, $next.FullName, $tweenPath, $BlendAmount)
            $manifestFrames.Add("$SetName/$action/$tweenName")
            $generated += "$SetName/$action/$tweenName"
        }
    }

    $animation = $manifest.sets.$SetName.animations.$action
    if (-not $animation) {
        $manifest.sets.$SetName.animations | Add-Member -NotePropertyName $action -NotePropertyValue ([pscustomobject]@{
            fps = 10
            loop = $false
            frames = @()
        })
        $animation = $manifest.sets.$SetName.animations.$action
    }

    $animation.fps = 10
    $animation.loop = $false
    $animation.frames = @($manifestFrames)
}

$manifest | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 -Path $manifestPath
$generated
Get-Content -Encoding UTF8 $manifestPath

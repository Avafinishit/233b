param(
    [string]$SourceSet = "soft-cat",
    [string]$TargetSet = "soft-cat-transparent",
    [double]$SolidTolerance = 24.0,
    [double]$FeatherTolerance = 58.0
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Drawing

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

public static class DokiTransparentBackground
{
    public static void Process(string inputPath, string outputPath, double solidTolerance, double featherTolerance)
    {
        using (var input = Image.FromFile(inputPath))
        using (var bitmap = new Bitmap(input.Width, input.Height, PixelFormat.Format32bppArgb))
        {
            using (var graphics = Graphics.FromImage(bitmap))
            {
                graphics.DrawImage(input, 0, 0, input.Width, input.Height);
            }

            int width = bitmap.Width;
            int height = bitmap.Height;
            Color bg = AverageEdgeColor(bitmap);
            bool[] background = FloodBackground(bitmap, bg, solidTolerance);

            var rect = new Rectangle(0, 0, width, height);
            BitmapData data = bitmap.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
            int length = Math.Abs(data.Stride) * height;
            byte[] bytes = new byte[length];
            Marshal.Copy(data.Scan0, bytes, 0, length);

            for (int y = 0; y < height; y++)
            {
                int row = y * data.Stride;
                for (int x = 0; x < width; x++)
                {
                    int flat = y * width + x;
                    if (!background[flat]) continue;

                    int index = row + (x * 4);
                    double distance = Distance(bytes[index + 2], bytes[index + 1], bytes[index], bg);
                    double alphaRatio = Math.Max(0.0, Math.Min(1.0, (distance - solidTolerance) / Math.Max(1.0, featherTolerance - solidTolerance)));
                    bytes[index + 3] = (byte)Math.Round(255.0 * alphaRatio);
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

    private static Color AverageEdgeColor(Bitmap bitmap)
    {
        long r = 0, g = 0, b = 0, count = 0;
        int width = bitmap.Width;
        int height = bitmap.Height;
        int step = Math.Max(1, Math.Min(width, height) / 64);

        for (int x = 0; x < width; x += step)
        {
            Add(bitmap.GetPixel(x, 0), ref r, ref g, ref b, ref count);
            Add(bitmap.GetPixel(x, height - 1), ref r, ref g, ref b, ref count);
        }
        for (int y = 0; y < height; y += step)
        {
            Add(bitmap.GetPixel(0, y), ref r, ref g, ref b, ref count);
            Add(bitmap.GetPixel(width - 1, y), ref r, ref g, ref b, ref count);
        }

        return Color.FromArgb((int)(r / count), (int)(g / count), (int)(b / count));
    }

    private static void Add(Color color, ref long r, ref long g, ref long b, ref long count)
    {
        r += color.R;
        g += color.G;
        b += color.B;
        count += 1;
    }

    private static bool[] FloodBackground(Bitmap bitmap, Color bg, double tolerance)
    {
        int width = bitmap.Width;
        int height = bitmap.Height;
        bool[] visited = new bool[width * height];
        bool[] background = new bool[width * height];
        Queue<int> queue = new Queue<int>();

        Action<int, int> enqueue = (x, y) => {
            if (x < 0 || y < 0 || x >= width || y >= height) return;
            int flat = y * width + x;
            if (visited[flat]) return;
            visited[flat] = true;
            Color color = bitmap.GetPixel(x, y);
            if (Distance(color.R, color.G, color.B, bg) <= tolerance)
            {
                background[flat] = true;
                queue.Enqueue(flat);
            }
        };

        for (int x = 0; x < width; x++)
        {
            enqueue(x, 0);
            enqueue(x, height - 1);
        }
        for (int y = 0; y < height; y++)
        {
            enqueue(0, y);
            enqueue(width - 1, y);
        }

        while (queue.Count > 0)
        {
            int flat = queue.Dequeue();
            int x = flat % width;
            int y = flat / width;
            enqueue(x + 1, y);
            enqueue(x - 1, y);
            enqueue(x, y + 1);
            enqueue(x, y - 1);
        }

        return background;
    }

    private static double Distance(int r, int g, int b, Color bg)
    {
        int dr = r - bg.R;
        int dg = g - bg.G;
        int db = b - bg.B;
        return Math.Sqrt((dr * dr) + (dg * dg) + (db * db));
    }
}
"@

$repoRoot = Split-Path -Parent $PSScriptRoot
$assetRoot = Join-Path $repoRoot "assets\doki\generated"
$sourceRoot = Join-Path $assetRoot $SourceSet
$targetRoot = Join-Path $assetRoot $TargetSet

if (-not (Test-Path -LiteralPath $sourceRoot)) {
    throw "Missing source Doki asset set: $sourceRoot"
}

$copied = @()
Get-ChildItem -LiteralPath $sourceRoot -Recurse -File | ForEach-Object {
    $relative = $_.FullName.Substring($sourceRoot.Length).TrimStart("\", "/")
    $targetPath = Join-Path $targetRoot $relative
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $targetPath) | Out-Null

    if ($_.Extension -ieq ".png") {
        [DokiTransparentBackground]::Process($_.FullName, $targetPath, $SolidTolerance, $FeatherTolerance)
    } else {
        Copy-Item -LiteralPath $_.FullName -Destination $targetPath -Force
    }

    $copied += $targetPath
}

$copied

# Regenerate browser, PWA, and Android launcher icons from the approved artwork.
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $root 'public/icon_2nd gen.png'
$source = [System.Drawing.Bitmap]::FromFile($sourcePath)
$green = $source.GetPixel(0, 0)
$pngFormat = [System.Drawing.Imaging.ImageFormat]::Png

function New-IconPng([int]$size, [string]$path, [double]$scale = 1, [bool]$round = $false) {
    $bitmap = [System.Drawing.Bitmap]::new($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.Clear($(if ($round) { [System.Drawing.Color]::Transparent } else { $green }))
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        if ($round) {
            $clip = [System.Drawing.Drawing2D.GraphicsPath]::new()
            $clip.AddEllipse(0, 0, $size, $size)
            $graphics.SetClip($clip)
            $clip.Dispose()
        }
        $inset = [int][Math]::Round($size * (1 - $scale) / 2)
        $drawSize = $size - 2 * $inset
        $graphics.DrawImage($source, $inset, $inset, $drawSize, $drawSize)
        $bitmap.Save($path, $pngFormat)
    } finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

try {
    $public = Join-Path $root 'public'
    foreach ($entry in @(
        @('favicon-16x16.png', 16), @('favicon-32x32.png', 32),
        @('apple-touch-icon.png', 180), @('app-icon-v2-180.png', 180),
        @('icon-192.png', 192), @('app-icon-v2-192.png', 192),
        @('icon-512.png', 512), @('app-icon-v2-512.png', 512)
    )) {
        New-IconPng ([int]$entry[1]) (Join-Path $public $entry[0])
    }
    New-IconPng 192 (Join-Path $public 'app-icon-maskable-192.png') 0.72
    New-IconPng 512 (Join-Path $public 'app-icon-maskable-512.png') 0.72

    # Replace the old logo in the shared social preview while preserving its text.
    $ogPath = Join-Path $public 'og-image.png'
    $oldOg = [System.Drawing.Bitmap]::FromFile($ogPath)
    $og = [System.Drawing.Bitmap]::new($oldOg.Width, $oldOg.Height)
    $ogGraphics = [System.Drawing.Graphics]::FromImage($og)
    try {
        $ogGraphics.DrawImageUnscaled($oldOg, 0, 0)
        $background = [System.Drawing.SolidBrush]::new($oldOg.GetPixel(0, 0))
        try { $ogGraphics.FillRectangle($background, 100, 145, 340, 340) }
        finally { $background.Dispose() }
        $ogGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $ogGraphics.DrawImage($source, 110, 155, 320, 320)
    } finally {
        $ogGraphics.Dispose()
        $oldOg.Dispose()
    }
    try { $og.Save($ogPath, $pngFormat) }
    finally { $og.Dispose() }

    # SVG browsers receive the same pixels as the source PNG.
    $encoded = [Convert]::ToBase64String([IO.File]::ReadAllBytes($sourcePath))
    $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><image width="1024" height="1024" href="data:image/png;base64,' + $encoded + '"/></svg>'
    [IO.File]::WriteAllText((Join-Path $public 'favicon.svg'), $svg, [Text.UTF8Encoding]::new($false))

    # ICO contains the matching 16 and 32 pixel PNGs for older browser shortcuts.
    $ico = [IO.MemoryStream]::new()
    $writer = [IO.BinaryWriter]::new($ico)
    try {
        $images = @()
        foreach ($size in @(16, 32)) {
            $images += ,([IO.File]::ReadAllBytes((Join-Path $public "favicon-${size}x${size}.png")))
        }
        $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]2)
        $offset = 6 + 16 * $images.Count
        for ($i = 0; $i -lt $images.Count; $i++) {
            $size = @(16, 32)[$i]
            $writer.Write([byte]$size); $writer.Write([byte]$size)
            $writer.Write([byte]0); $writer.Write([byte]0)
            $writer.Write([uint16]1); $writer.Write([uint16]32)
            $writer.Write([uint32]$images[$i].Length); $writer.Write([uint32]$offset)
            $offset += $images[$i].Length
        }
        foreach ($bytes in $images) { $writer.Write([byte[]]$bytes) }
        [IO.File]::WriteAllBytes((Join-Path $public 'favicon.ico'), $ico.ToArray())
    } finally {
        $writer.Dispose()
        $ico.Dispose()
    }

    $android = Join-Path $root 'android/app/src/main/res'
    foreach ($density in @(
        @('mdpi', 48, 108), @('hdpi', 72, 162), @('xhdpi', 96, 216),
        @('xxhdpi', 144, 324), @('xxxhdpi', 192, 432)
    )) {
        $folder = Join-Path $android "mipmap-$($density[0])"
        New-IconPng ([int]$density[1]) (Join-Path $folder 'ic_launcher.png')
        New-IconPng ([int]$density[1]) (Join-Path $folder 'ic_launcher_round.png') 1 $true
        New-IconPng ([int]$density[2]) (Join-Path $folder 'ic_launcher_foreground.png') 0.667
    }
} finally {
    $source.Dispose()
}

param([string]$Sequence = '1234')
$ErrorActionPreference = 'Stop'
if ($Sequence -notmatch '^1[23]*4$') { throw 'Sequence must match 1[23]*4.' }
Add-Type -AssemblyName System.Drawing
$data = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'level-points.json') -Raw | ConvertFrom-Json
$imagePath = Join-Path $PSScriptRoot ('sequence-' + $Sequence + '.png')
$canvas = [Drawing.Bitmap]::new($imagePath)
$g = [Drawing.Graphics]::FromImage($canvas)
$g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$fill = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#482b29'))
$textBrush = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#fff0cd'))
$shadow = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(140, 0, 0, 0))
$border = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#b29259'), 3)
$innerBorder = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#281b1d'), 2)
$font = [Drawing.Font]::new('Georgia', 21, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
$format = [Drawing.StringFormat]::new()
$format.Alignment = [Drawing.StringAlignment]::Center
$format.LineAlignment = [Drawing.StringAlignment]::Center
$level = 0
try {
    for ($i = 0; $i -lt $Sequence.Length; $i++) {
        $tile = $Sequence.Substring($i, 1)
        foreach ($point in $data.points.$tile) {
            $level++
            [single]$x = $i * $data.tileWidth + $point.x
            [single]$y = $point.y
            $g.FillEllipse($shadow, $x - 29, $y - 24, 58, 58)
            $g.FillEllipse($fill, $x - 26, $y - 26, 52, 52)
            $g.DrawEllipse($border, $x - 25.5, $y - 25.5, 51, 51)
            $g.DrawEllipse($innerBorder, $x - 22, $y - 22, 44, 44)
            $g.DrawString([string]$level, $font, $textBrush, [Drawing.RectangleF]::new($x - 27, $y - 27, 54, 54), $format)
        }
    }
    $canvas.Save((Join-Path $PSScriptRoot ('buttons-' + $Sequence + '.png')), [Drawing.Imaging.ImageFormat]::Png)
    Write-Output ('Rendered ' + $level + ' sample buttons for ' + $Sequence + '. Source PNG assets remain clean.')
} finally {
    $format.Dispose(); $font.Dispose(); $innerBorder.Dispose(); $border.Dispose()
    $shadow.Dispose(); $textBrush.Dispose(); $fill.Dispose(); $g.Dispose(); $canvas.Dispose()
}

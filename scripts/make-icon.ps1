# Disegna l'icona dell'app (build/icon.png, 512x512): quattro quadratini arrotondati su fondo viola.
# Uso: powershell -File scripts/make-icon.ps1
Add-Type -AssemblyName System.Drawing

function RoundRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

$size = 512
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.Clear([System.Drawing.Color]::Transparent)

$bg = RoundRect 16 16 480 480 110
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Point 0, 0), (New-Object System.Drawing.Point 512, 512), ([System.Drawing.Color]::FromArgb(255, 108, 108, 255)), ([System.Drawing.Color]::FromArgb(255, 72, 64, 214))
$g.FillPath($brush, $bg)

$alphas = @(255, 150, 95, 215)
$cell = 150; $gap = 36; $start = (512 - (2 * $cell + $gap)) / 2
for ($i = 0; $i -lt 4; $i++) {
  $x = $start + ($i % 2) * ($cell + $gap)
  $y = $start + [math]::Floor($i / 2) * ($cell + $gap)
  $sq = RoundRect $x $y $cell $cell 38
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($alphas[$i], 255, 255, 255))), $sq)
}

$out = Join-Path (Split-Path $PSScriptRoot -Parent) 'build\icon.png'
New-Item -ItemType Directory -Force (Split-Path $out) | Out-Null
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "Icona salvata in $out"

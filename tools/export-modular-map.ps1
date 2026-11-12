param(
    [string]$SourceAtlas = (Join-Path $PSScriptRoot '..\output\modular-map\source-atlas.png'),
    [string]$AssetDirectory = (Join-Path $PSScriptRoot '..\assets\resources\images\level-select\maps\continuous\modular'),
    [string]$PreviewDirectory = (Join-Path $PSScriptRoot '..\output\modular-map'),
    [string]$ConnectorAtlas = '',
    [string]$LastTileOverride = '',
    [int]$ConnectorCenterX = 470,
    [string]$TileOverridesDirectory = ''
)

$ErrorActionPreference = 'Stop'
if (-not $ConnectorAtlas) { $ConnectorAtlas = $SourceAtlas }
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Path $AssetDirectory, $PreviewDirectory -Force | Out-Null

# The art is generated with image_gen. This export reuses ONE painted connector
# on every port, then cuts and assembles PNG assets at the original tile size.
# Optional high-resolution tile repairs are normalized to that same size.
# Preserve 24 exact columns at each port and feather the donor into the interior.
$exportCode = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Collections.Generic;

public static class ModularMapExporter {
    const int W = 543, H = 724, Band = 72, Locked = 24;

    static Color Mix(Color original, Color connector, double amount) {
        return Color.FromArgb(255,
            (int)Math.Round(original.R + (connector.R - original.R) * amount),
            (int)Math.Round(original.G + (connector.G - original.G) * amount),
            (int)Math.Round(original.B + (connector.B - original.B) * amount));
    }

    static void ApplyPort(Bitmap tile, Bitmap atlas, int connectorCenterX, bool left) {
        for (int d = 0; d < Band; d++) {
            // Reuse a visually checked continuous strip of quiet scenery.
            // Every legal join then uses exactly the same painted interface.
            int x = left ? d : W - 1 - d;
            int sourceX = left ? connectorCenterX + d : connectorCenterX - 1 - d;
            double t = Math.Max(0, Math.Min(1, (double)(d - Locked) / (Band - 1 - Locked)));
            double weight = 1 - t * t * (3 - 2 * t);
            for (int y = 0; y < H; y++) {
                tile.SetPixel(x, y, Mix(tile.GetPixel(x, y), atlas.GetPixel(sourceX, y), weight));
            }
        }
    }

    static void SaveSequence(Bitmap[] tiles, string sequence, string file) {
        using (var result = new Bitmap(W * sequence.Length, H, PixelFormat.Format32bppArgb)) {
            using (var graphics = Graphics.FromImage(result)) {
                for (int i = 0; i < sequence.Length; i++)
                    graphics.DrawImageUnscaled(tiles[sequence[i] - '1'], W * i, 0);
            }
            result.Save(file, ImageFormat.Png);
        }
    }

    public static void Export(string source, string connectorSource, string lastTileOverride, int connectorCenterX, string tileOverridesDirectory, string assets, string previews) {
        using (var atlas = new Bitmap(source))
        using (var connector = new Bitmap(connectorSource)) {
            if (atlas.Width != W * 4 || atlas.Height != H || connector.Width != W * 4 || connector.Height != H)
                throw new InvalidOperationException("Source atlas must be exactly 2172x724; do not stretch individual tiles.");
            if (connectorCenterX < Band || connectorCenterX + Band > connector.Width)
                throw new ArgumentOutOfRangeException("connectorCenterX");
            var tiles = new Bitmap[4];
            try {
                for (int i = 0; i < 4; i++) {
                    tiles[i] = atlas.Clone(new Rectangle(i * W, 0, W, H), PixelFormat.Format32bppArgb);
                    string overridePath = i == 3 ? lastTileOverride : "";
                    if (!String.IsNullOrEmpty(tileOverridesDirectory)) {
                        string candidate = Path.Combine(tileOverridesDirectory, "map_0" + (i + 1) + ".png");
                        if (File.Exists(candidate)) overridePath = candidate;
                    }
                    if (!String.IsNullOrEmpty(overridePath)) {
                        using (var replacement = new Bitmap(overridePath)) {
                            if (replacement.Width * H != replacement.Height * W)
                                throw new InvalidOperationException("Tile override must have the same 3:4 aspect ratio.");
                            using (var g = Graphics.FromImage(tiles[i]))
                            using (var attributes = new ImageAttributes()) {
                                attributes.SetWrapMode(System.Drawing.Drawing2D.WrapMode.TileFlipXY);
                                g.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceCopy;
                                g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                                g.DrawImage(replacement, new Rectangle(0, 0, W, H), 0, 0, replacement.Width, replacement.Height, GraphicsUnit.Pixel, attributes);
                            }
                        }
                    }
                    if (i > 0) ApplyPort(tiles[i], connector, connectorCenterX, true);
                    if (i < 3) ApplyPort(tiles[i], connector, connectorCenterX, false);
                    tiles[i].Save(Path.Combine(assets, "map_0" + (i + 1) + ".png"), ImageFormat.Png);
                }

                var pairs = new string[] { "12", "13", "14", "22", "23", "24", "32", "33", "34" };
                var results = new List<string>();
                foreach (string pair in pairs) {
                    int mismatch = 0;
                    for (int y = 0; y < H; y++) {
                        for (int d = 0; d < Locked; d++) {
                            if (tiles[pair[0] - '1'].GetPixel(W - Locked + d, y).ToArgb() !=
                                connector.GetPixel(connectorCenterX - Locked + d, y).ToArgb()) mismatch++;
                            if (tiles[pair[1] - '1'].GetPixel(d, y).ToArgb() !=
                                connector.GetPixel(connectorCenterX + d, y).ToArgb()) mismatch++;
                        }
                    }
                    if (mismatch != 0) throw new InvalidOperationException("Connector mismatch: " + pair);
                    results.Add("    {\"pair\": \"" + pair + "\", \"mismatchedConnectorPixels\": " + mismatch + "}");
                }

                string[] sequences = { "14", "1234", "124", "134", "1224", "13234", "1334", "1324", "122334" };
                foreach (string sequence in sequences)
                    SaveSequence(tiles, sequence, Path.Combine(previews, "sequence-" + sequence + ".png"));
                SaveSequence(tiles, "1234", Path.Combine(assets, "map_full.png"));

                const int PreviewW = 180, PreviewH = 240, Gap = 18, LabelH = 30;
                using (var sheet = new Bitmap(PreviewW * 5 + 32, 6 * (PreviewH + LabelH + Gap) + 16)) {
                    using (var g = Graphics.FromImage(sheet))
                    using (var font = new Font("Arial", 14))
                    using (var brush = new SolidBrush(Color.FromArgb(225, 225, 225))) {
                        g.Clear(Color.FromArgb(24, 26, 30));
                        g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                        for (int row = 0; row < 6; row++) {
                            int y = 16 + row * (PreviewH + LabelH + Gap);
                            g.DrawString(sequences[row], font, brush, 16, y);
                            // Scale the assembled strip once to avoid interpolation
                            // introducing artificial dark strokes at tile boundaries.
                            using (var strip = new Bitmap(Path.Combine(previews, "sequence-" + sequences[row] + ".png")))
                                g.DrawImage(strip, 16, y + LabelH, PreviewW * sequences[row].Length, PreviewH);
                        }
                    }
                    sheet.Save(Path.Combine(previews, "combinations.png"), ImageFormat.Png);
                }

                // Show all nine joins at native scale (128px on either side).
                using (var sheet = new Bitmap(3 * 256, 3 * (H + 28))) {
                    using (var g = Graphics.FromImage(sheet))
                    using (var font = new Font("Arial", 14)) {
                        g.Clear(Color.FromArgb(24, 26, 30));
                        for (int p = 0; p < pairs.Length; p++) {
                            int x = (p % 3) * 256, y = (p / 3) * (H + 28);
                            g.DrawString(pairs[p], font, Brushes.White, x + 8, y + 2);
                            using (var a = tiles[pairs[p][0] - '1'].Clone(new Rectangle(W - 128, 0, 128, H), PixelFormat.Format32bppArgb))
                            using (var b = tiles[pairs[p][1] - '1'].Clone(new Rectangle(0, 0, 128, H), PixelFormat.Format32bppArgb)) {
                                g.DrawImageUnscaled(a, x, y + 28);
                                g.DrawImageUnscaled(b, x + 128, y + 28);
                            }
                        }
                    }
                    sheet.Save(Path.Combine(previews, "seams.png"), ImageFormat.Png);
                }
                File.WriteAllText(Path.Combine(previews, "validation.json"),
                    "{\n  \"tileWidth\": 543,\n  \"tileHeight\": 724,\n  \"sequenceRule\": \"^1[23]*4$\",\n" +
                    "  \"connectorSourceRightEnd\": " + (connectorCenterX - 1) + ",\n  \"connectorSourceLeftStart\": " + connectorCenterX + ",\n  \"lockedColumnsPerSide\": 24,\n  \"transitionColumnsPerSide\": 72,\n" +
                    "  \"validation\": \"Every legal join exactly reproduces the same continuous 48-column painted interface, away from atlas dividers.\",\n  \"pairs\": [\n" +
                    String.Join(",\n", results.ToArray()) + "\n  ]\n}\n");
            } finally {
                foreach (var tile in tiles) if (tile != null) tile.Dispose();
            }
        }
    }
}
'@

if (-not ('ModularMapExporter' -as [type])) {
    Add-Type -TypeDefinition $exportCode -ReferencedAssemblies System.Drawing
}
[ModularMapExporter]::Export(
    [IO.Path]::GetFullPath($SourceAtlas),
    [IO.Path]::GetFullPath($ConnectorAtlas),
    $(if ($LastTileOverride) { [IO.Path]::GetFullPath($LastTileOverride) } else { '' }),
    $ConnectorCenterX,
    $(if ($TileOverridesDirectory) { [IO.Path]::GetFullPath($TileOverridesDirectory) } else { '' }),
    [IO.Path]::GetFullPath($AssetDirectory),
    [IO.Path]::GetFullPath($PreviewDirectory)
)

# Reuse project import settings, assigning fresh stable UUIDs only on first export.
$originalDirectory = Split-Path $AssetDirectory -Parent
foreach ($name in @('map_01', 'map_02', 'map_03', 'map_04', 'map_full')) {
    $metaPath = Join-Path $AssetDirectory ($name + '.png.meta')
    if (-not (Test-Path -LiteralPath $metaPath)) {
        $templatePath = Join-Path $originalDirectory ($name + '.png.meta')
        $template = Get-Content -LiteralPath $templatePath -Raw
        $oldUuid = ($template | ConvertFrom-Json).uuid
        $newUuid = [guid]::NewGuid().ToString()
        [IO.File]::WriteAllText([IO.Path]::GetFullPath($metaPath), $template.Replace($oldUuid, $newUuid))
    }
}
$directoryMeta = $AssetDirectory.TrimEnd('\', '/') + '.meta'
if (-not (Test-Path -LiteralPath $directoryMeta)) {
    $meta = @{ ver = '1.2.0'; importer = 'directory'; imported = $true; uuid = [guid]::NewGuid().ToString(); files = @(); subMetas = @{}; userData = @{} }
    [IO.File]::WriteAllText([IO.Path]::GetFullPath($directoryMeta), ($meta | ConvertTo-Json -Depth 4))
}
Write-Output 'Exported four 543x724 tiles and previews. All 9 legal connectors passed pixel validation.'

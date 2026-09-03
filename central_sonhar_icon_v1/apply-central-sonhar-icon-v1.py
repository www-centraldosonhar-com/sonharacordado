from pathlib import Path
import shutil

root = Path.cwd()
source = root / "central_sonhar_icon_v1"

for name in ["apple-touch-icon.png", "pwa-192x192.png", "pwa-512x512.png"]:
    src = source / name
    if not src.exists():
        raise SystemExit(f"❌ Arquivo ausente: {src}")
    shutil.copy2(src, root / "public" / name)

index = root / "index.html"
s = index.read_text(encoding="utf-8")
s = s.replace('<link rel="apple-touch-icon" href="/watermark.png" />',
              '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />')
s = s.replace('<meta name="apple-mobile-web-app-title" content="Central do Sonhar" />',
              '<meta name="apple-mobile-web-app-title" content="Central Sonhar" />')
s = s.replace('<title>Central do Sonhar</title>', '<title>Central Sonhar</title>')
index.write_text(s, encoding="utf-8")

manifest = root / "public/manifest.webmanifest"
manifest.write_text("""{
  "name": "Central Sonhar",
  "short_name": "Central Sonhar",
  "description": "Central do Voluntário Sonhador",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#ffffff",
  "theme_color": "#ffffff",
  "icons": [
    {
      "src": "/pwa-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/pwa-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    }
  ]
}
""", encoding="utf-8")

print("✅ Central Sonhar configurada com o novo ícone.")

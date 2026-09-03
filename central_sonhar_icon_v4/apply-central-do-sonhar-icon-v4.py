from pathlib import Path
import shutil, re

root = Path.cwd()
source = root / "central_sonhar_icon_v4"
public = root / "public"

for name in [
    "central-do-sonhar-apple-v4.png",
    "central-do-sonhar-192-v4.png",
    "central-do-sonhar-512-v4.png",
]:
    src = source / name
    if not src.exists():
        raise SystemExit(f"❌ Arquivo ausente: {src}")
    shutil.copy2(src, public / name)

index = root / "index.html"
s = index.read_text(encoding="utf-8")

s = re.sub(
    r'<link rel="manifest" href="[^"]+" ?/?>',
    '<link rel="manifest" href="/manifest.webmanifest?v=4" />',
    s,
    count=1,
)

s = re.sub(
    r'<link rel="apple-touch-icon"[^>]*>',
    '<link rel="apple-touch-icon" sizes="180x180" href="/central-do-sonhar-apple-v4.png" />',
    s,
    count=1,
)

s = re.sub(
    r'<meta name="apple-mobile-web-app-title" content="[^"]*" ?/?>',
    '<meta name="apple-mobile-web-app-title" content="Central do Sonhar" />',
    s,
    count=1,
)

s = re.sub(
    r'<title>.*?</title>',
    '<title>Central do Sonhar</title>',
    s,
    count=1,
)

index.write_text(s, encoding="utf-8")

manifest = root / "public/manifest.webmanifest"
m = manifest.read_text(encoding="utf-8")

m = re.sub(r'"name"\s*:\s*"[^"]*"', '"name": "Central do Sonhar"', m, count=1)
m = re.sub(r'"short_name"\s*:\s*"[^"]*"', '"short_name": "Central do Sonhar"', m, count=1)

m = re.sub(
    r'"/(?:central-sonhar|central-do-sonhar|pwa)-192(?:x192)?(?:-v\d+)?\.png"',
    '"/central-do-sonhar-192-v4.png"',
    m,
)
m = re.sub(
    r'"/(?:central-sonhar|central-do-sonhar|pwa)-512(?:x512)?(?:-v\d+)?\.png"',
    '"/central-do-sonhar-512-v4.png"',
    m,
)

# Fallback para nomes atuais conhecidos.
m = m.replace('"/central-sonhar-192-v3.png"', '"/central-do-sonhar-192-v4.png"')
m = m.replace('"/central-sonhar-512-v3.png"', '"/central-do-sonhar-512-v4.png"')
m = m.replace('"/central-sonhar-192-v2.png"', '"/central-do-sonhar-192-v4.png"')
m = m.replace('"/central-sonhar-512-v2.png"', '"/central-do-sonhar-512-v4.png"')
m = m.replace('"/pwa-192x192.png"', '"/central-do-sonhar-192-v4.png"')
m = m.replace('"/pwa-512x512.png"', '"/central-do-sonhar-512-v4.png"')

manifest.write_text(m, encoding="utf-8")

print("✅ Nome restaurado para: Central do Sonhar")
print("✅ Ícones v4 aplicados com fundo externo transparente.")
print("✅ Desenho ampliado para ocupar a área do ícone.")
print("✅ Manifest e apple-touch-icon atualizados para v4.")

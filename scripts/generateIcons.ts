import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const PUBLIC_DIR = path.join(process.cwd(), 'public');

// Master Pure Symbol SVG (Clean, bold, modern, highly legible at any size)
function getPureSymbolSvg(
  theme: 'dark' | 'light' = 'dark',
  mode: 'rounded' | 'square' | 'maskable' = 'rounded'
) {
  const isDark = theme === 'dark';
  const bg = isDark ? '#0B0F19' : '#FFFFFF';
  const nodeColor = isDark ? '#F8FAFC' : '#0F172A';

  const rx = mode === 'rounded' ? 'rx="112"' : '';
  // For maskable icons, scale down to 0.76 to guarantee it stays within the inner 80% circle safe zone
  const scale = mode === 'maskable' ? 'scale(0.76)' : 'scale(1.15)';
  const translateY = mode === 'maskable' ? 'translate(-256, -244)' : 'translate(-256, -244)';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="symGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${nodeColor}" />
      <stop offset="100%" stop-color="${isDark ? '#E2E8F0' : '#1E293B'}" />
    </linearGradient>
  </defs>

  <!-- Background Canvas -->
  <rect width="512" height="512" ${rx} fill="${bg}" />

  <!-- The Nexus Molecular Constellation Symbol (Centered & Scaled) -->
  <g transform="translate(256, 256) ${scale} ${translateY}" fill="url(#symGrad)">
    <!-- Standalone Satellites in Diamond Grid -->
    <circle cx="256" cy="140" r="18" />
    <circle cx="204" cy="192" r="18" />
    <circle cx="308" cy="192" r="18" />
    <circle cx="152" cy="244" r="18" />
    <circle cx="256" cy="348" r="18" />

    <!-- Connected Continuous Wave / 'N' Backbone -->
    <path d="M 204 296 L 256 244" stroke="url(#symGrad)" stroke-width="36" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M 256 244 L 308 296" stroke="url(#symGrad)" stroke-width="36" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M 308 296 L 360 244" stroke="url(#symGrad)" stroke-width="36" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Joint Nodes on the Chain -->
    <circle cx="204" cy="296" r="26" />
    <circle cx="256" cy="244" r="26" />
    <circle cx="308" cy="296" r="24" />
    <circle cx="360" cy="244" r="26" />
  </g>
</svg>`;
}

// Full Logo with Text (for large banners and OG cards)
function getFullBrandTileSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F8FAFC" />
      <stop offset="100%" stop-color="#CBD5E1" />
    </linearGradient>
  </defs>

  <rect width="512" height="512" rx="108" fill="#0B0F19" />

  <g transform="translate(256, 185) scale(0.9) translate(-256, -244)" fill="url(#brandGrad)">
    <circle cx="256" cy="140" r="18" />
    <circle cx="204" cy="192" r="18" />
    <circle cx="308" cy="192" r="18" />
    <circle cx="152" cy="244" r="18" />
    <circle cx="256" cy="348" r="18" />

    <path d="M 204 296 L 256 244" stroke="url(#brandGrad)" stroke-width="36" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M 256 244 L 308 296" stroke="url(#brandGrad)" stroke-width="36" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M 308 296 L 360 244" stroke="url(#brandGrad)" stroke-width="36" stroke-linecap="round" stroke-linejoin="round" />

    <circle cx="204" cy="296" r="26" />
    <circle cx="256" cy="244" r="26" />
    <circle cx="308" cy="296" r="26" />
    <circle cx="360" cy="244" r="26" />
  </g>

  <text x="256" y="390" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="800" fill="#F8FAFC" text-anchor="middle" letter-spacing="8">BSE NEXUS</text>
</svg>`;
}

// Social Share OpenGraph Banner (1200x630)
function getSocialOgSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="ogBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#080C14" />
      <stop offset="50%" stop-color="#0B0F19" />
      <stop offset="100%" stop-color="#05080E" />
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#ogBg)" />

  <g opacity="0.08" stroke="#FFFFFF" stroke-width="1.5">
    <line x1="0" y1="150" x2="1200" y2="150" />
    <line x1="0" y1="315" x2="1200" y2="315" />
    <line x1="0" y1="480" x2="1200" y2="480" />
    <line x1="300" y1="0" x2="300" y2="630" />
    <line x1="600" y1="0" x2="600" y2="630" />
    <line x1="900" y1="0" x2="900" y2="630" />
  </g>

  <g transform="translate(600, 220) scale(1.15) translate(-256, -244)" fill="#F8FAFC">
    <circle cx="256" cy="140" r="18" />
    <circle cx="204" cy="192" r="18" />
    <circle cx="308" cy="192" r="18" />
    <circle cx="152" cy="244" r="18" />
    <circle cx="256" cy="348" r="18" />

    <path d="M 204 296 L 256 244" stroke="#F8FAFC" stroke-width="36" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M 256 244 L 308 296" stroke="#F8FAFC" stroke-width="36" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M 308 296 L 360 244" stroke="#F8FAFC" stroke-width="36" stroke-linecap="round" stroke-linejoin="round" />

    <circle cx="204" cy="296" r="26" />
    <circle cx="256" cy="244" r="26" />
    <circle cx="308" cy="296" r="26" />
    <circle cx="360" cy="244" r="26" />
  </g>

  <text x="600" y="440" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="58" font-weight="900" fill="#F8FAFC" text-anchor="middle" letter-spacing="12">BSE NEXUS</text>
  <text x="600" y="490" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="500" fill="#94A3B8" text-anchor="middle" letter-spacing="4">FINANCIAL DISCLOSURES &amp; INTELLIGENCE TERMINAL</text>
</svg>`;
}

export async function generateAllAssets() {
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  // 1. Write the vector SVG files
  const pureSymbolRoundedSvg = getPureSymbolSvg('dark', 'rounded');
  const pureSymbolSquareSvg = getPureSymbolSvg('dark', 'square');
  const pureSymbolMaskableSvg = getPureSymbolSvg('dark', 'maskable');
  const fullTileSvgStr = getFullBrandTileSvg();
  const ogSvgStr = getSocialOgSvg();

  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon.svg'), pureSymbolRoundedSvg, 'utf-8');
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon-full.svg'), fullTileSvgStr, 'utf-8');

  const squareBuffer = Buffer.from(pureSymbolSquareSvg);
  const maskableBuffer = Buffer.from(pureSymbolMaskableSvg);
  const ogBuffer = Buffer.from(ogSvgStr);

  // 2. All app icons, touch icons, and favicons use clean truecolor RGBA PNG
  const iconTargets = [
    { name: 'favicon-16x16.png', size: 16, source: squareBuffer },
    { name: 'favicon-32x32.png', size: 32, source: squareBuffer },
    { name: 'favicon-48x48.png', size: 48, source: squareBuffer },
    { name: 'apple-touch-icon.png', size: 180, source: squareBuffer },
    { name: 'apple-touch-icon-180x180.png', size: 180, source: squareBuffer },
    { name: 'apple-touch-icon-152x152.png', size: 152, source: squareBuffer },
    { name: 'apple-touch-icon-120x120.png', size: 120, source: squareBuffer },
    { name: 'apple-touch-icon-precomposed.png', size: 180, source: squareBuffer },
    { name: 'android-chrome-192x192.png', size: 192, source: squareBuffer },
    { name: 'android-chrome-512x512.png', size: 512, source: squareBuffer },
    { name: 'pwa-192x192.png', size: 192, source: squareBuffer },
    { name: 'pwa-512x512.png', size: 512, source: squareBuffer },
    { name: 'icon-192.png', size: 192, source: maskableBuffer },
    { name: 'icon-512.png', size: 512, source: maskableBuffer },
    { name: 'pwa-maskable-512x512.png', size: 512, source: maskableBuffer },
    { name: 'mstile-150x150.png', size: 150, source: squareBuffer }
  ];

  console.log('Rendering new clean pure-symbol Nexus logo assets...');

  for (const target of iconTargets) {
    const dest = path.join(PUBLIC_DIR, target.name);
    await sharp(target.source)
      .resize(target.size, target.size, {
        fit: 'contain',
        background: { r: 11, g: 15, b: 25, alpha: 1 }
      })
      .png({ palette: false, quality: 100, compressionLevel: 6 })
      .toFile(dest);
    console.log(`✓ Generated ${target.name} (${target.size}x${target.size})`);
  }

  // Favicon.ico with valid ICO binary header + 32x32 RGBA PNG
  const faviconPng = await sharp(squareBuffer)
    .resize(32, 32, { fit: 'contain', background: { r: 11, g: 15, b: 25, alpha: 1 } })
    .png({ palette: false, quality: 100, compressionLevel: 6 })
    .toBuffer();

  const icoHeader = Buffer.alloc(22);
  icoHeader.writeUInt16LE(0, 0); // Reserved
  icoHeader.writeUInt16LE(1, 2); // Type 1 = ICO
  icoHeader.writeUInt16LE(1, 4); // 1 image
  icoHeader.writeUInt8(32, 6);   // width
  icoHeader.writeUInt8(32, 7);   // height
  icoHeader.writeUInt8(0, 8);    // color count
  icoHeader.writeUInt8(0, 9);    // reserved
  icoHeader.writeUInt16LE(1, 10); // color planes
  icoHeader.writeUInt16LE(32, 12); // bits per pixel
  icoHeader.writeUInt32LE(faviconPng.length, 14); // image byte length
  icoHeader.writeUInt32LE(22, 18); // offset to image data

  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), Buffer.concat([icoHeader, faviconPng]));
  console.log('✓ Generated valid favicon.ico (32x32 ICO resource)');

  // OG Social image (1200x630 Truecolor RGBA)
  await sharp(ogBuffer)
    .png({ palette: false, quality: 95, compressionLevel: 6 })
    .toFile(path.join(PUBLIC_DIR, 'og-image.png'));
  console.log('✓ Generated og-image.png (1200x630)');

  console.log('All custom logo formats generated successfully!');
}

generateAllAssets().catch(err => {
  console.error('Error generating assets:', err);
});

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, '..', 'assets');

// ── SVG Definitions ──────────────────────────────────────────────────────────

// Icon 1024x1024 : fond brun foncé, bouteille ambrée + étoile
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <!-- Fond -->
  <rect width="1024" height="1024" fill="#0F0500"/>

  <!-- Cercle de fond ambré glow -->
  <circle cx="512" cy="512" r="420" fill="#1E1006"/>
  <circle cx="512" cy="512" r="400" fill="none" stroke="#F5A623" stroke-width="8" opacity="0.3"/>

  <!-- Bouteille -->
  <!-- Corps de la bouteille -->
  <rect x="420" y="460" width="184" height="340" rx="40" ry="40" fill="#C17D0F"/>
  <rect x="436" y="476" width="152" height="308" rx="32" ry="32" fill="#E8940E"/>

  <!-- Reflet bouteille -->
  <rect x="452" y="492" width="44" height="260" rx="22" ry="22" fill="#F5B84A" opacity="0.35"/>

  <!-- Col de la bouteille -->
  <rect x="456" y="340" width="112" height="130" rx="20" ry="20" fill="#C17D0F"/>
  <rect x="470" y="353" width="84" height="104" rx="14" ry="14" fill="#E8940E"/>

  <!-- Bouchon -->
  <rect x="448" y="300" width="128" height="52" rx="14" ry="14" fill="#F5A623"/>
  <rect x="462" y="312" width="100" height="28" rx="8" ry="8" fill="#FFD070"/>

  <!-- Étiquette -->
  <rect x="432" y="510" width="160" height="180" rx="12" ry="12" fill="#0F0500" opacity="0.55"/>
  <text x="512" y="575" text-anchor="middle" fill="#F5A623" font-family="Georgia, serif" font-size="36" font-weight="bold">Beer</text>
  <text x="512" y="618" text-anchor="middle" fill="#F5A623" font-family="Georgia, serif" font-size="36" font-weight="bold">Cellar</text>
  <!-- Petite ligne déco -->
  <line x1="452" y1="635" x2="572" y2="635" stroke="#F5A623" stroke-width="2" opacity="0.6"/>

  <!-- Étoile en haut à droite -->
  <g transform="translate(660, 290)">
    <polygon points="50,0 61,35 97,35 68,57 79,91 50,70 21,91 32,57 3,35 39,35"
      fill="#F5A623" opacity="0.95"/>
  </g>

  <!-- Mousse qui déborde légèrement -->
  <ellipse cx="512" cy="457" rx="75" ry="22" fill="#FFF8E7" opacity="0.85"/>
  <ellipse cx="480" cy="452" rx="22" ry="16" fill="#FFF8E7" opacity="0.7"/>
  <ellipse cx="544" cy="452" rx="18" ry="14" fill="#FFF8E7" opacity="0.7"/>
</svg>`;

// Adaptive icon foreground 1024x1024 : fond transparent, même bouteille centrée + légèrement agrandie
const adaptiveFgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <!-- Bouteille centrée, légèrement agrandie pour tenir compte du safe zone -->
  <!-- Corps -->
  <rect x="390" y="430" width="244" height="380" rx="48" ry="48" fill="#C17D0F"/>
  <rect x="408" y="448" width="208" height="344" rx="38" ry="38" fill="#E8940E"/>
  <!-- Reflet -->
  <rect x="426" y="466" width="56" height="288" rx="28" ry="28" fill="#F5B84A" opacity="0.35"/>
  <!-- Col -->
  <rect x="428" y="300" width="168" height="142" rx="24" ry="24" fill="#C17D0F"/>
  <rect x="444" y="315" width="136" height="114" rx="18" ry="18" fill="#E8940E"/>
  <!-- Bouchon -->
  <rect x="418" y="254" width="188" height="58" rx="18" ry="18" fill="#F5A623"/>
  <rect x="434" y="268" width="156" height="30" rx="10" ry="10" fill="#FFD070"/>
  <!-- Étiquette -->
  <rect x="402" y="482" width="220" height="200" rx="14" ry="14" fill="#0F0500" opacity="0.55"/>
  <text x="512" y="554" text-anchor="middle" fill="#F5A623" font-family="Georgia, serif" font-size="44" font-weight="bold">Beer</text>
  <text x="512" y="606" text-anchor="middle" fill="#F5A623" font-family="Georgia, serif" font-size="44" font-weight="bold">Cellar</text>
  <line x1="424" y1="626" x2="600" y2="626" stroke="#F5A623" stroke-width="2" opacity="0.6"/>
  <!-- Mousse -->
  <ellipse cx="512" cy="426" rx="92" ry="26" fill="#FFF8E7" opacity="0.85"/>
  <ellipse cx="474" cy="420" rx="28" ry="19" fill="#FFF8E7" opacity="0.7"/>
  <ellipse cx="550" cy="420" rx="24" ry="17" fill="#FFF8E7" opacity="0.7"/>
  <!-- Étoile -->
  <g transform="translate(680, 270)">
    <polygon points="46,0 56,32 90,32 63,52 73,84 46,64 19,84 29,52 2,32 36,32"
      fill="#F5A623" opacity="0.95"/>
  </g>
</svg>`;

// Splash screen 1284x2778 (iPhone 14 Pro Max, valeur safe)
const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1284" height="2778" viewBox="0 0 1284 2778">
  <!-- Fond dégradé brun très sombre -->
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#1E1006"/>
      <stop offset="100%" stop-color="#0F0500"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#F5A623" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#F5A623" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1284" height="2778" fill="url(#bg)"/>

  <!-- Halo ambré -->
  <ellipse cx="642" cy="1200" rx="600" ry="600" fill="url(#glow)"/>

  <!-- Bouteille -->
  <g transform="translate(642,1150)">
    <!-- Corps -->
    <rect x="-110" y="-200" width="220" height="360" rx="44" ry="44" fill="#C17D0F"/>
    <rect x="-94" y="-184" width="188" height="328" rx="36" ry="36" fill="#E8940E"/>
    <!-- Reflet -->
    <rect x="-78" y="-168" width="52" height="276" rx="26" ry="26" fill="#F5B84A" opacity="0.35"/>
    <!-- Col -->
    <rect x="-76" y="-340" width="152" height="152" rx="22" ry="22" fill="#C17D0F"/>
    <rect x="-62" y="-326" width="124" height="124" rx="16" ry="16" fill="#E8940E"/>
    <!-- Bouchon -->
    <rect x="-86" y="-390" width="172" height="58" rx="16" ry="16" fill="#F5A623"/>
    <rect x="-72" y="-376" width="144" height="28" rx="8" ry="8" fill="#FFD070"/>
    <!-- Étiquette -->
    <rect x="-102" y="-178" width="204" height="194" rx="12" ry="12" fill="#0F0500" opacity="0.55"/>
    <text x="0" y="-108" text-anchor="middle" fill="#F5A623" font-family="Georgia, serif" font-size="42" font-weight="bold">Beer</text>
    <text x="0" y="-56" text-anchor="middle" fill="#F5A623" font-family="Georgia, serif" font-size="42" font-weight="bold">Cellar</text>
    <line x1="-80" y1="-34" x2="80" y2="-34" stroke="#F5A623" stroke-width="2" opacity="0.6"/>
    <!-- Mousse -->
    <ellipse cx="0" cy="-204" rx="84" ry="24" fill="#FFF8E7" opacity="0.85"/>
    <ellipse cx="-36" cy="-210" rx="24" ry="17" fill="#FFF8E7" opacity="0.7"/>
    <ellipse cx="36" cy="-210" rx="20" ry="15" fill="#FFF8E7" opacity="0.7"/>
  </g>

  <!-- Titre app -->
  <text x="642" y="1570" text-anchor="middle" fill="#F5A623"
    font-family="Georgia, serif" font-size="82" font-weight="bold" letter-spacing="3">BeerCellar</text>
  <text x="642" y="1630" text-anchor="middle" fill="#9A7A5A"
    font-family="Georgia, serif" font-size="36" letter-spacing="2">Ma cave à bières</text>

  <!-- Ligne déco -->
  <line x1="492" y1="1660" x2="792" y2="1660" stroke="#F5A623" stroke-width="1.5" opacity="0.4"/>
</svg>`;

// Play Store icon 512x512 (même design, fond opaque requis)
const storeIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#0F0500"/>
  <circle cx="256" cy="256" r="210" fill="#1E1006"/>
  <circle cx="256" cy="256" r="200" fill="none" stroke="#F5A623" stroke-width="4" opacity="0.3"/>
  <rect x="210" y="230" width="92" height="170" rx="20" fill="#C17D0F"/>
  <rect x="218" y="238" width="76" height="154" rx="16" fill="#E8940E"/>
  <rect x="226" y="246" width="22" height="130" rx="11" fill="#F5B84A" opacity="0.35"/>
  <rect x="228" y="170" width="56" height="65" rx="10" fill="#C17D0F"/>
  <rect x="235" y="177" width="42" height="52" rx="7" fill="#E8940E"/>
  <rect x="224" y="150" width="64" height="26" rx="7" fill="#F5A623"/>
  <rect x="231" y="156" width="50" height="14" rx="4" fill="#FFD070"/>
  <rect x="216" y="255" width="80" height="90" rx="6" fill="#0F0500" opacity="0.55"/>
  <text x="256" y="291" text-anchor="middle" fill="#F5A623" font-family="Georgia, serif" font-size="18" font-weight="bold">Beer</text>
  <text x="256" y="312" text-anchor="middle" fill="#F5A623" font-family="Georgia, serif" font-size="18" font-weight="bold">Cellar</text>
  <line x1="226" y1="320" x2="286" y2="320" stroke="#F5A623" stroke-width="1" opacity="0.6"/>
  <ellipse cx="256" cy="228" rx="38" ry="11" fill="#FFF8E7" opacity="0.85"/>
  <ellipse cx="238" cy="225" rx="11" ry="8" fill="#FFF8E7" opacity="0.7"/>
  <ellipse cx="274" cy="225" rx="9" ry="7" fill="#FFF8E7" opacity="0.7"/>
  <g transform="translate(330, 145)">
    <polygon points="25,0 31,18 49,18 35,29 40,46 25,35 10,46 15,29 1,18 19,18" fill="#F5A623" opacity="0.95"/>
  </g>
</svg>`;

// Feature graphic 1024x500 — texte centré sur la moitié droite (cx=700)
const featureGraphicSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>
    <radialGradient id="bg" cx="28%" cy="50%" r="65%">
      <stop offset="0%" stop-color="#1E1006"/>
      <stop offset="100%" stop-color="#0F0500"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#F5A623" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#F5A623" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="500" fill="url(#bg)"/>
  <ellipse cx="240" cy="250" rx="260" ry="260" fill="url(#glow)"/>

  <!-- Séparateur vertical discret -->
  <line x1="420" y1="60" x2="420" y2="440" stroke="#F5A623" stroke-width="1" opacity="0.15"/>

  <!-- Bouteille centrée à x=220 -->
  <g transform="translate(220, 252)">
    <rect x="-68" y="-125" width="136" height="230" rx="28" fill="#C17D0F"/>
    <rect x="-56" y="-113" width="112" height="206" rx="22" fill="#E8940E"/>
    <rect x="-44" y="-101" width="32" height="172" rx="16" fill="#F5B84A" opacity="0.35"/>
    <rect x="-48" y="-212" width="96" height="96" rx="15" fill="#C17D0F"/>
    <rect x="-36" y="-200" width="72" height="80" rx="11" fill="#E8940E"/>
    <rect x="-56" y="-248" width="112" height="42" rx="11" fill="#F5A623"/>
    <rect x="-44" y="-236" width="88" height="20" rx="6" fill="#FFD070"/>
    <rect x="-60" y="-101" width="120" height="134" rx="8" fill="#0F0500" opacity="0.55"/>
    <text x="0" y="-55" text-anchor="middle" fill="#F5A623" font-family="Georgia, serif" font-size="26" font-weight="bold">Beer</text>
    <text x="0" y="-21" text-anchor="middle" fill="#F5A623" font-family="Georgia, serif" font-size="26" font-weight="bold">Cellar</text>
    <line x1="-48" y1="-4" x2="48" y2="-4" stroke="#F5A623" stroke-width="1.5" opacity="0.6"/>
    <ellipse cx="0" cy="-129" rx="54" ry="15" fill="#FFF8E7" opacity="0.85"/>
    <ellipse cx="-22" cy="-133" rx="15" ry="11" fill="#FFF8E7" opacity="0.7"/>
    <ellipse cx="22" cy="-133" rx="13" ry="9" fill="#FFF8E7" opacity="0.7"/>
  </g>

  <!-- Bloc texte centré à x=716 (milieu de 420..1012) -->
  <!-- Titre : font-size 64 → "BeerCellar" ≈ 360px → 716±180 = 536..896 ✓ -->
  <text x="716" y="192" text-anchor="middle"
    fill="#F5A623" font-family="Georgia, serif" font-size="64" font-weight="bold" letter-spacing="2">BeerCellar</text>

  <!-- Ligne déco sous le titre -->
  <line x1="490" y1="212" x2="942" y2="212" stroke="#F5A623" stroke-width="1.5" opacity="0.35"/>

  <!-- Sous-titre : font-size 22 → "Ma cave à bières personnelle" ≈ 400px → 716±200 = 516..916 ✓ -->
  <text x="716" y="254" text-anchor="middle"
    fill="#9A7A5A" font-family="Georgia, serif" font-size="22" letter-spacing="1">Ma cave à bières personnelle</text>

  <!-- Tags centrés à x=716, 3 × 110px + 2 × 12px = 354px → 716±177 = 539..893 ✓ -->
  <rect x="539" y="288" width="108" height="36" rx="18" fill="#1E1006" stroke="#F5A623" stroke-width="1.5" opacity="0.8"/>
  <text x="593" y="311" text-anchor="middle" fill="#F5A623" font-family="Arial, sans-serif" font-size="15">Cave</text>

  <rect x="659" y="288" width="114" height="36" rx="18" fill="#1E1006" stroke="#F5A623" stroke-width="1.5" opacity="0.8"/>
  <text x="716" y="311" text-anchor="middle" fill="#F5A623" font-family="Arial, sans-serif" font-size="15">Groupes</text>

  <rect x="785" y="288" width="108" height="36" rx="18" fill="#1E1006" stroke="#F5A623" stroke-width="1.5" opacity="0.8"/>
  <text x="839" y="311" text-anchor="middle" fill="#F5A623" font-family="Arial, sans-serif" font-size="15">Notes</text>

  <!-- Étoiles déco -->
  <g transform="translate(458, 148)">
    <polygon points="16,0 19,11 31,11 22,18 25,29 16,22 7,29 10,18 1,11 13,11" fill="#F5A623" opacity="0.5"/>
  </g>
  <g transform="translate(940, 370)">
    <polygon points="12,0 14,8 23,8 16,13 19,22 12,16 5,22 8,13 1,8 10,8" fill="#F5A623" opacity="0.35"/>
  </g>
</svg>`;

// Favicon 48x48
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <rect width="48" height="48" rx="10" fill="#0F0500"/>
  <rect x="18" y="22" width="12" height="18" rx="3" fill="#E8940E"/>
  <rect x="20" y="15" width="8" height="9" rx="2" fill="#E8940E"/>
  <rect x="19" y="12" width="10" height="4" rx="2" fill="#F5A623"/>
  <ellipse cx="24" cy="22" rx="5" ry="2" fill="#FFF8E7" opacity="0.85"/>
</svg>`;

// ── Generate ─────────────────────────────────────────────────────────────────

async function svgToPng(svgString, outputPath, width, height) {
  await sharp(Buffer.from(svgString))
    .resize(width, height)
    .png()
    .toFile(outputPath);
  console.log(`✅ ${path.basename(outputPath)} (${width}×${height})`);
}

async function main() {
  await svgToPng(iconSvg,            path.join(assetsDir, 'icon.png'),               1024, 1024);
  await svgToPng(adaptiveFgSvg,      path.join(assetsDir, 'adaptive-icon.png'),      1024, 1024);
  await svgToPng(splashSvg,          path.join(assetsDir, 'splash-icon.png'),        1284, 2778);
  await svgToPng(faviconSvg,         path.join(assetsDir, 'favicon.png'),              48,   48);
  await svgToPng(storeIconSvg,       path.join(assetsDir, 'store-icon.png'),          512,  512);
  await svgToPng(featureGraphicSvg,  path.join(assetsDir, 'store-feature-graphic.png'), 1024, 500);
  console.log('\n🍺 Tous les assets ont été générés dans /assets/');
}

main().catch(console.error);

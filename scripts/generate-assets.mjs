import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, '..', 'assets');

// ── Shared design : bouteille + verre ballon sur pied ───────────────────────
//
//  Bouteille centrée en x=335, base en y=790
//  Verre     centré  en x=689  base en y=796
//
//  Verre ballon :
//    - Pied   : y=782-796, largeur 164
//    - Tige   : x=682-696  y=712-782
//    - Ballon : path bezier ouverture y=400, ventre max y=530, tige y=712
//
//  Bowl glass path (outer) :
//    M 622 400
//    C 606 412, 577 460, 577 530   ← gauche haut → ventre
//    C 577 600, 632 692, 682 712   ← gauche bas  → tige
//    L 696 712                     ← traverse tige
//    C 746 692, 801 600, 801 530   ← droite bas → ventre
//    C 801 460, 772 412, 756 400   ← droite haut → ouverture
//    Z

// Beer liquid path (bière : de y=436 au bas du bol, ~86% plein)
// À y=436 le verre mesure ≈608-770 (interp. linéaire rim→ventre)
const beerLiquidPath =
  'M 608 436 L 770 436 ' +
  'C 793 458,801 494,801 530 ' +   // droite haut → ventre
  'C 801 600,746 692,696 712 ' +   // droite bas  → tige
  'L 682 712 ' +                    // traverse tige
  'C 632 692,577 600,577 530 ' +   // gauche bas → ventre
  'C 577 494,585 458,608 436 Z';   // gauche haut → niveau bière

const glassOutlinePath =
  'M 622 400 ' +
  'C 606 412,577 460,577 530 ' +
  'C 577 600,632 692,682 712 ' +
  'L 696 712 ' +
  'C 746 692,801 600,801 530 ' +
  'C 801 460,772 412,756 400 Z';

const bottleAndGlass = `
  <!-- ===== BOUTEILLE (centre x=335, base y=790) ===== -->

  <!-- Bouchon -->
  <rect x="295" y="222" width="80" height="46" rx="14" fill="#D4821A"/>
  <rect x="307" y="232" width="56" height="24" rx="8" fill="#F5C842"/>

  <!-- Col -->
  <rect x="307" y="264" width="56" height="122" rx="15" fill="#7A5008"/>
  <rect x="319" y="274" width="32" height="106" rx="10" fill="#C17D0F"/>

  <!-- Épaule (trapèze de transition col → corps) -->
  <polygon points="275,480 395,480 363,382 307,382" fill="#7A5008"/>
  <polygon points="287,474 383,474 355,388 319,388" fill="#C17D0F"/>

  <!-- Corps -->
  <rect x="275" y="468" width="120" height="322" rx="44" fill="#7A5008"/>
  <rect x="287" y="478" width="96" height="300" rx="36" fill="#C17D0F"/>
  <!-- Reflet -->
  <rect x="299" y="490" width="26" height="252" rx="13" fill="#E8B84A" opacity="0.32"/>

  <!-- Étiquette -->
  <rect x="281" y="510" width="108" height="164" rx="10" fill="#0F0500" opacity="0.62"/>
  <text x="335" y="572" text-anchor="middle" fill="#F5A623"
    font-family="Georgia,serif" font-size="28" font-weight="bold">Beer</text>
  <text x="335" y="612" text-anchor="middle" fill="#F5A623"
    font-family="Georgia,serif" font-size="28" font-weight="bold">Cellar</text>
  <line x1="297" y1="628" x2="373" y2="628" stroke="#F5A623" stroke-width="1.5" opacity="0.45"/>

  <!-- ===== VERRE BALLON SUR PIED (centre x=689) ===== -->

  <!-- Bière (liquide ambré) -->
  <path d="${beerLiquidPath}" fill="#C97010"/>
  <!-- Reflet lumineux en surface de la bière -->
  <rect x="608" y="436" width="162" height="38" fill="#F0A030" opacity="0.30"/>

  <!-- Bulles -->
  <circle cx="652" cy="690" r="5"  fill="rgba(255,180,20,0.42)"/>
  <circle cx="671" cy="630" r="3"  fill="rgba(255,180,20,0.38)"/>
  <circle cx="712" cy="574" r="6"  fill="rgba(255,180,20,0.30)"/>
  <circle cx="660" cy="516" r="4"  fill="rgba(255,180,20,0.38)"/>
  <circle cx="722" cy="478" r="3"  fill="rgba(255,180,20,0.32)"/>

  <!-- Mousse (au niveau de la bière, y≈436) -->
  <ellipse cx="689" cy="428" rx="82" ry="22"  fill="#FFF8E7"/>
  <ellipse cx="648" cy="435" rx="27" ry="16"  fill="#FFF8E7" opacity="0.86"/>
  <ellipse cx="728" cy="434" rx="22" ry="14"  fill="#FFF8E7" opacity="0.86"/>
  <ellipse cx="689" cy="431" rx="14" ry="10"  fill="#FFF8E7" opacity="0.70"/>

  <!-- Contour du verre ballon -->
  <path d="${glassOutlinePath}"
    fill="rgba(255,255,255,0.03)" stroke="#C17D0F" stroke-width="6" stroke-linejoin="round"/>

  <!-- Glare (reflet vertical gauche du verre) -->
  <path d="M 592 420 C 588 440,584 490,584 530 C 584 590,598 650,608 700 C 600 650,586 590,586 530 C 586 490,590 440,594 420 Z"
    fill="rgba(255,255,255,0.13)"/>

  <!-- Tige -->
  <rect x="682" y="712" width="14" height="70" fill="#8B5008"/>
  <rect x="686" y="716" width="6"  height="62" fill="#C17D0F" opacity="0.6"/>

  <!-- Pied -->
  <rect x="609" y="780" width="160" height="16" rx="8"  fill="#9A6010"/>
  <rect x="597" y="793" width="184" height="8"  rx="4"  fill="#7A4A06"/>
`;

// ── Icon 1024×1024 ───────────────────────────────────────────────────────────
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#1E1006"/>
      <stop offset="100%" stop-color="#0F0500"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bgGrad)"/>
  <circle cx="512" cy="512" r="438" fill="none" stroke="#F5A623" stroke-width="5" opacity="0.15"/>
  <ellipse cx="335" cy="560" rx="120" ry="260" fill="#F5A623" opacity="0.05"/>
  <ellipse cx="689" cy="600" rx="150" ry="220" fill="#F5A623" opacity="0.06"/>
  ${bottleAndGlass}
</svg>`;

// ── Adaptive icon foreground 1024×1024 (fond transparent) ───────────────────
const adaptiveFgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${bottleAndGlass}
</svg>`;

// ── Splash 1284×2778 ─────────────────────────────────────────────────────────
const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1284" height="2778" viewBox="0 0 1284 2778">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="60%">
      <stop offset="0%" stop-color="#1E1006"/>
      <stop offset="100%" stop-color="#0F0500"/>
    </radialGradient>
  </defs>
  <rect width="1284" height="2778" fill="url(#bg)"/>
  <!-- Bouteille + verre, scale 0.72, centré horizontalement -->
  <!-- tx = (1284 - 1024*0.72)/2 = (1284-737.3)/2 ≈ 273 -->
  <g transform="translate(273, 560) scale(0.72)">
    ${bottleAndGlass}
  </g>
  <!-- Titre -->
  <text x="642" y="1656" text-anchor="middle" fill="#F5A623"
    font-family="Georgia,serif" font-size="84" font-weight="bold" letter-spacing="3">BeerCellar</text>
  <text x="642" y="1720" text-anchor="middle" fill="#9A7A5A"
    font-family="Georgia,serif" font-size="36" letter-spacing="2">Ma cave à bières</text>
  <line x1="492" y1="1750" x2="792" y2="1750" stroke="#F5A623" stroke-width="1.5" opacity="0.35"/>
</svg>`;

// ── Play Store icon 512×512 ──────────────────────────────────────────────────
const storeIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#1E1006"/>
      <stop offset="100%" stop-color="#0F0500"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" rx="160" fill="url(#bgGrad)"/>
  <circle cx="512" cy="512" r="438" fill="none" stroke="#F5A623" stroke-width="5" opacity="0.15"/>
  <ellipse cx="335" cy="560" rx="120" ry="260" fill="#F5A623" opacity="0.05"/>
  <ellipse cx="689" cy="600" rx="150" ry="220" fill="#F5A623" opacity="0.06"/>
  ${bottleAndGlass}
</svg>`;

// ── Feature graphic 1024×500 ─────────────────────────────────────────────────
const featureGraphicSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>
    <radialGradient id="bg" cx="24%" cy="50%" r="65%">
      <stop offset="0%" stop-color="#1E1006"/>
      <stop offset="100%" stop-color="#0F0500"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="500" fill="url(#bg)"/>
  <!-- Séparateur -->
  <line x1="430" y1="50" x2="430" y2="450" stroke="#F5A623" stroke-width="1" opacity="0.12"/>
  <!-- Bouteille + verre, scale 0.40, repositionné -->
  <!-- tx = -62, ty = -58  pour centrer le duo dans x=0..430, y=0..500 -->
  <g transform="translate(-62, -58) scale(0.40)">
    ${bottleAndGlass}
  </g>
  <!-- Texte centré à x=726 -->
  <text x="726" y="190" text-anchor="middle"
    fill="#F5A623" font-family="Georgia,serif" font-size="64" font-weight="bold" letter-spacing="2">BeerCellar</text>
  <line x1="496" y1="210" x2="956" y2="210" stroke="#F5A623" stroke-width="1.5" opacity="0.32"/>
  <text x="726" y="252" text-anchor="middle"
    fill="#9A7A5A" font-family="Georgia,serif" font-size="22" letter-spacing="1">Ma cave à bières personnelle</text>
  <rect x="544" y="284" width="108" height="36" rx="18" fill="#1E1006" stroke="#F5A623" stroke-width="1.5" opacity="0.8"/>
  <text x="598" y="307" text-anchor="middle" fill="#F5A623" font-family="Arial,sans-serif" font-size="15">Cave</text>
  <rect x="662" y="284" width="128" height="36" rx="18" fill="#1E1006" stroke="#F5A623" stroke-width="1.5" opacity="0.8"/>
  <text x="726" y="307" text-anchor="middle" fill="#F5A623" font-family="Arial,sans-serif" font-size="15">Groupes</text>
  <rect x="800" y="284" width="108" height="36" rx="18" fill="#1E1006" stroke="#F5A623" stroke-width="1.5" opacity="0.8"/>
  <text x="854" y="307" text-anchor="middle" fill="#F5A623" font-family="Arial,sans-serif" font-size="15">Notes</text>
</svg>`;

// ── Favicon 48×48 ────────────────────────────────────────────────────────────
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <rect width="48" height="48" rx="10" fill="#0F0500"/>
  <!-- Verre ballon mini -->
  <path d="M 14 7 C 11 10,9 16,9 21 C 9 29,13 36,18 38 L 20 38 L 20 42 L 16 42 L 16 44 L 32 44 L 32 42 L 28 42 L 28 38 L 30 38 C 35 36,39 29,39 21 C 39 16,37 10,34 7 Z"
    fill="#C97010"/>
  <path d="M 14 7 C 11 10,9 16,9 21 C 9 29,13 36,18 38 L 30 38 C 35 36,39 29,39 21 C 39 16,37 10,34 7 Z"
    fill="none" stroke="#C17D0F" stroke-width="2"/>
  <ellipse cx="24" cy="18" rx="10" ry="4" fill="#FFF8E7" opacity="0.9"/>
  <circle cx="18" cy="28" r="1.5" fill="rgba(255,180,20,0.5)"/>
  <circle cx="24" cy="22" r="1"   fill="rgba(255,180,20,0.45)"/>
  <circle cx="30" cy="30" r="2"   fill="rgba(255,180,20,0.4)"/>
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
  await svgToPng(iconSvg,            path.join(assetsDir, 'icon.png'),                  1024, 1024);
  await svgToPng(adaptiveFgSvg,      path.join(assetsDir, 'adaptive-icon.png'),         1024, 1024);
  await svgToPng(splashSvg,          path.join(assetsDir, 'splash-icon.png'),           1284, 2778);
  await svgToPng(faviconSvg,         path.join(assetsDir, 'favicon.png'),                 48,   48);
  await svgToPng(storeIconSvg,       path.join(assetsDir, 'store-icon.png'),             512,  512);
  await svgToPng(featureGraphicSvg,  path.join(assetsDir, 'store-feature-graphic.png'), 1024,  500);
  console.log('\n🍺 Tous les assets ont été générés dans /assets/');
}

main().catch(console.error);

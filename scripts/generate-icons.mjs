import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generateIcons() {
  const svgPath = path.resolve('./public/icon.svg');
  const svgBuffer = fs.readFileSync(svgPath);

  // 192x192 standard icon
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.resolve('./public/pwa-192x192.png'));
  console.log('Generated pwa-192x192.png');

  // 512x512 standard icon
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.resolve('./public/pwa-512x512.png'));
  console.log('Generated pwa-512x512.png');

  // 180x180 Apple touch icon
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.resolve('./public/apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // 512x512 maskable icon with 10% safe zone padding as per PWA skill
  await sharp(svgBuffer)
    .resize(410, 410)
    .extend({
      top: 51,
      bottom: 51,
      left: 51,
      right: 51,
      background: '#0369a1'
    })
    .png()
    .toFile(path.resolve('./public/pwa-maskable-512x512.png'));
  console.log('Generated pwa-maskable-512x512.png');

  // 64x64 favicon
  await sharp(svgBuffer)
    .resize(64, 64)
    .png()
    .toFile(path.resolve('./public/favicon.ico'));
  console.log('Generated favicon.ico');
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});

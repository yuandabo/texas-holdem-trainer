const sharp = require('sharp');
const path = require('path');

const resDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

const sizes = [
    { dir: 'mipmap-mdpi', size: 48 },
    { dir: 'mipmap-hdpi', size: 72 },
    { dir: 'mipmap-xhdpi', size: 96 },
    { dir: 'mipmap-xxhdpi', size: 144 },
    { dir: 'mipmap-xxxhdpi', size: 192 },
];

// 自适应图标前景层尺寸 (108dp, 比 launcher 大)
const foregroundSizes = [
    { dir: 'mipmap-mdpi', size: 108 },
    { dir: 'mipmap-hdpi', size: 162 },
    { dir: 'mipmap-xhdpi', size: 216 },
    { dir: 'mipmap-xxhdpi', size: 324 },
    { dir: 'mipmap-xxxhdpi', size: 432 },
];

const src = path.join(__dirname, '..', 'icon.png');

async function generate() {
    for (const { dir, size } of sizes) {
        const outDir = path.join(resDir, dir);

        // ic_launcher.png
        await sharp(src)
            .resize(size, size, { fit: 'cover' })
            .png()
            .toFile(path.join(outDir, 'ic_launcher.png'));

        // ic_launcher_round.png — 圆形裁剪
        const roundMask = Buffer.from(
            `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`
        );
        await sharp(src)
            .resize(size, size, { fit: 'cover' })
            .composite([{ input: roundMask, blend: 'dest-in' }])
            .png()
            .toFile(path.join(outDir, 'ic_launcher_round.png'));

        console.log(`✓ ${dir}: ${size}x${size}`);
    }

    // 前景层
    for (const { dir, size } of foregroundSizes) {
        const outDir = path.join(resDir, dir);
        await sharp(src)
            .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toFile(path.join(outDir, 'ic_launcher_foreground.png'));

        console.log(`✓ ${dir} foreground: ${size}x${size}`);
    }

    console.log('\nDone! All icons generated.');
}

generate().catch(console.error);

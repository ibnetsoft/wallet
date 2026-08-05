const sharp = require('sharp');
const fs = require('fs');

async function createFavicon() {
  try {
    const inputFile = 'logo.png';
    const metadata = await sharp(inputFile).metadata();
    
    console.log(`Original dimensions: ${metadata.width}x${metadata.height}`);

    // We want the left jewel part and the "U".
    // Assuming the jewel is roughly on the far left, let's crop a square from the left side.
    const cropSize = Math.min(metadata.width, metadata.height); // usually height is smaller in a logo banner
    const widthToCrop = Math.min(cropSize * 1.5, metadata.width); // give it a little more width if needed, or just a square
    
    // Let's crop a square from the left edge (or slightly offset if there's padding)
    // The user said: "왼쪽 보석부분, U 자 앞부분만 뗴서" (left jewel part, just the U part)
    // Let's take the first 30% of the width, or a square matching the height.
    const size = metadata.height;
    
    await sharp(inputFile)
      .extract({ left: 0, top: 0, width: size, height: size })
      .resize(192, 192)
      .toFile('favicon.png');

    await sharp(inputFile)
      .extract({ left: 0, top: 0, width: size, height: size })
      .resize(32, 32)
      .toFile('favicon.ico');
      
    // Create an apple-touch-icon
    await sharp(inputFile)
      .extract({ left: 0, top: 0, width: size, height: size })
      .resize(180, 180)
      .toFile('apple-icon.png');

    // Also update the logo image in admin if needed, but for now just web-app
    console.log('Favicons generated successfully!');
  } catch (err) {
    console.error('Error generating favicon:', err);
  }
}

createFavicon();

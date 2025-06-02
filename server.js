const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
    input: {
        spritePath: './ringbell.png',
        numFrames: 16, // Total number of frames in the sprite sheet
        // Adjust the frame rate as needed
        // This is the number of frames per second for the animation
        // If you have a specific frame rate, set it here
        // For example, if you want 12 frames per second, set it to 12
        // If you want to use a custom frame rate, adjust it accordingly
        frameRate: 12,
        layout: {
            isHorizontal: false,
            padding: 0,
            trim: false,
            grid: { rows: 4, cols: 4 }, //Adjust these according to your sprite sheet
            // If you have custom frame coordinates, specify them here
            // Example: { left: 0, top: 0, width: 64, height: 64 }
            customFrames: []
        }
    },
    output: {
        jsonPath: './ringbell.json',
        framesDir: './ringbellframes',
        imageOptions: {
            format: 'png',
            quality: 100,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
    }
};

// Ensure output directory exists
if (!fs.existsSync(config.output.framesDir)) {
    fs.mkdirSync(config.output.framesDir, { recursive: true });
}

// Clean up frames directory
function cleanFramesDirectory() {
    if (fs.existsSync(config.output.framesDir)) {
        fs.readdirSync(config.output.framesDir)
            .filter(file => file.endsWith('.png'))
            .forEach(file => fs.unlinkSync(path.join(config.output.framesDir, file)));
    }
}

// Analyze sprite and get frame dimensions
async function analyzeSprite() {
    try {
        const metadata = await sharp(config.input.spritePath).metadata();
        console.log('Analyzing sprite sheet...');
        console.log('Full sprite dimensions:', metadata.width, 'x', metadata.height);

        if (config.input.layout.customFrames.length > 0) {
            console.log('Using custom frame coordinates');
            return {
                frameWidth: config.input.layout.customFrames[0].width,
                frameHeight: config.input.layout.customFrames[0].height,
                metadata
            };
        }

        const frameWidth = Math.floor(metadata.width / config.input.layout.grid.cols);
        const frameHeight = Math.floor(metadata.height / config.input.layout.grid.rows);
        console.log(`Detected ${config.input.numFrames} frames in a ${config.input.layout.grid.rows}x${config.input.layout.grid.cols} grid`);
        console.log(`Individual frame size: ${frameWidth}x${frameHeight}`);
        return { frameWidth, frameHeight, metadata };
    } catch (error) {
        console.error('Error analyzing sprite:', error);
        throw error;
    }
}

// Extract individual frames
async function extractFrames(dimensions) {
    try {
        const { frameWidth, frameHeight } = dimensions;
        const promises = [];

        for (let i = 0; i < config.input.numFrames; i++) {
            let extractOptions;

            if (config.input.layout.customFrames.length > 0) {
                extractOptions = config.input.layout.customFrames[i];
            } else {
                const row = Math.floor(i / config.input.layout.grid.cols);
                const col = i % config.input.layout.grid.cols;
                extractOptions = {
                    left: col * frameWidth,
                    top: row * frameHeight,
                    width: frameWidth,
                    height: frameHeight
                };
            }

            console.log(`Extracting frame ${i + 1}:`, extractOptions);

            let pipeline = sharp(config.input.spritePath)
                .extract(extractOptions);

            if (config.input.layout.trim) {
                pipeline = pipeline.trim();
            }

            promises.push(
                pipeline
                    .toFormat(config.output.imageOptions.format, {
                        quality: config.output.imageOptions.quality
                    })
                    .toFile(path.join(config.output.framesDir, `frame${i + 1}.png`))
            );
        }

        await Promise.all(promises);
        console.log(`Successfully extracted ${config.input.numFrames} frames`);
    } catch (error) {
        console.error('Error extracting frames:', error);
        throw error;
    }
}

// Convert frames to base64
function getFramesAsBase64() {
    return Array.from({ length: config.input.numFrames }, (_, i) => {
        const framePath = path.join(config.output.framesDir, `frame${i + 1}.png`);
        const data = fs.readFileSync(framePath);
        return 'data:image/png;base64,' + data.toString('base64');
    });
}

// Generate Lottie JSON
function generateLottieJSON(dimensions) {
    const { frameWidth, frameHeight } = dimensions;
    const frameImages = getFramesAsBase64();
    
    const lottieJSON = {
        v: "5.9.0",
        fr: config.input.frameRate,
        ip: 0,
        op: config.input.numFrames,
        w: frameWidth,
        h: frameHeight,
        nm: "HorseWalkingAnimation",
        ddd: 0,
        assets: frameImages.map((data, i) => ({
            id: `image_${i}`,
            p: data,
            u: "",
            w: frameWidth,
            h: frameHeight,
            e: 1
        })),
        layers: []
    };
    
    // Create a layer for each frame with specific visibility timing
    for (let i = 0; i < config.input.numFrames; i++) {
        lottieJSON.layers.push({
            ddd: 0,
            ind: i + 1,
            ty: 2,
            nm: `Frame ${i + 1}`,
            refId: `image_${i}`,
            sr: 1,
            ks: {
                o: { 
                    a: 1,
                    k: [
                        { t: i, s: [100], h: 1 },
                        { t: i + 0.99, s: [100], h: 1 },
                        { t: i + 1, s: [0], h: 1 }
                    ]
                },
                r: { a: 0, k: 0 },
                p: { a: 0, k: [frameWidth/2, frameHeight/2, 0] },
                a: { a: 0, k: [frameWidth/2, frameHeight/2, 0] },
                s: { a: 0, k: [100, 100, 100] }
            },
            ao: 0,
            ip: i,
            op: i + 1,
            st: 0,
            bm: 0
        });
    }
    
    fs.writeFileSync(config.output.jsonPath, JSON.stringify(lottieJSON, null, 2));
    console.log(`Lottie JSON saved to ${config.output.jsonPath}`);
}

// Main process
async function main() {
    try {
        console.log('Starting sprite to Lottie conversion...');
        
        cleanFramesDirectory();
        const dimensions = await analyzeSprite();
        await extractFrames(dimensions);
        generateLottieJSON(dimensions);
        
        console.log('Conversion completed successfully!');
    } catch (error) {
        console.error('Conversion failed:', error);
        process.exit(1);
    }
}

main();

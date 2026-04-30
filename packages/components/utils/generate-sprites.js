#!/usr/bin/env node
/**
 * Generates SVG sprite files from individual SVG sources.
 * Outputs to: packages/core/dist/public/sprites/
 * Uses filenames from icons-manifest.js
 */

const fs = require('fs');
const path = require('path');

const ICON_SRC = path.resolve(__dirname, '../src/components/icon');
const MANIFEST = require('../src/components/icon/icons-manifest.js');
const OUTPUT_DIR = path.resolve(__dirname, '../../../packages/core/dist/public/sprites');

// Helper: convert kebab-case filename to sprite id
function fileNameToId(filename) {
    // e.g. ic-contract-entry-spot -> ic-contract-entry-spot (already kebab)
    return filename;
}

// Helper: extract inner SVG content and viewBox from an SVG string
function parseSvg(content) {
    // Get viewBox
    const viewBoxMatch = content.match(/viewBox="([^"]+)"/);
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24';

    // Get width/height if no viewBox
    const widthMatch = content.match(/width="([^"]+)"/);
    const heightMatch = content.match(/height="([^"]+)"/);
    const w = widthMatch ? widthMatch[1] : '24';
    const h = heightMatch ? heightMatch[1] : '24';
    const finalViewBox = viewBox || `0 0 ${w} ${h}`;

    // Extract inner content (between <svg...> and </svg>)
    const innerMatch = content.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
    const inner = innerMatch ? innerMatch[1].trim() : '';

    return { viewBox: finalViewBox, inner };
}

// Build sprites per category
function buildSprites() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const categories = Object.keys(MANIFEST);

    categories.forEach(category => {
        const filename = MANIFEST[category]; // e.g. "contract.ce9d310321a5d689d0bd48d128b9419b"
        const categoryDir = path.join(ICON_SRC, category);

        if (!fs.existsSync(categoryDir)) {
            console.warn(`Category dir missing: ${categoryDir}`);
            return;
        }

        const svgFiles = fs.readdirSync(categoryDir).filter(f => f.endsWith('.svg'));
        if (svgFiles.length === 0) {
            console.warn(`No SVG files in: ${categoryDir}`);
            return;
        }

        let symbols = '';
        svgFiles.forEach(svgFile => {
            const svgPath = path.join(categoryDir, svgFile);
            const content = fs.readFileSync(svgPath, 'utf8');
            const { viewBox, inner } = parseSvg(content);

            // sprite_id is the filename without extension (already kebab-case)
            const spriteId = svgFile.replace('.svg', '');

            symbols += `  <symbol id="${spriteId}" viewBox="${viewBox}">${inner}</symbol>\n`;
        });

        const sprite = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n${symbols}</svg>`;
        const outPath = path.join(OUTPUT_DIR, `${filename}.svg`);
        fs.writeFileSync(outPath, sprite, 'utf8');
        console.log(`Generated: ${filename}.svg (${svgFiles.length} icons)`);
    });

    console.log('\nDone! Sprites written to:', OUTPUT_DIR);
}

buildSprites();

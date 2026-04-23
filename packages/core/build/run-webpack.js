#!/usr/bin/env node
'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
// Reduce memory pressure
process.env.UV_THREADPOOL_SIZE = '2';

const path = require('path');
const webpack = require(path.resolve(__dirname, '../../..', 'node_modules/webpack'));
const configFn = require('./webpack.config.js');
let config = typeof configFn === 'function' ? configFn({}) : configFn;

// Memory optimisations: disable source maps and minimise parallelism
config = {
    ...config,
    devtool: false,
    cache: { type: 'filesystem' },
    parallelism: 1,
};

console.log('Building with webpack', webpack.version, '...');

const compiler = webpack(config);
compiler.run((err, stats) => {
    if (err) {
        console.error('Fatal webpack error:', err.message);
        process.exit(1);
    }
    const info = stats.toJson();
    if (stats.hasErrors()) {
        info.errors.forEach(e => console.error(e.message || e));
        process.exit(1);
    }
    if (stats.hasWarnings()) {
        info.warnings.slice(0, 3).forEach(w => console.warn(w.message || w));
    }
    console.log(`\nwebpack ${webpack.version} compiled successfully in ${(info.time / 1000).toFixed(1)}s`);

    // Generate SVG sprite files (icon component uses sprites from /public/sprites/)
    try {
        require('../../../packages/components/utils/generate-sprites.js');
        console.log('SVG sprites generated.');
    } catch (e) {
        console.warn('Could not generate sprites:', e.message);
    }

    process.exit(0);
});

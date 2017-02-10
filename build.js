var Builder = require('systemjs-builder');

var builder = new Builder('src');

builder
.buildStatic('baseplate.js', 'bin/baseplate.js', {
    config: {
        defaultJSExtensions: true,
        packages: {
        }
    },
    externals: [],
    globalName: 'Baseplate',
    globalDeps: {
    },
    minify: false,
    runtime: true,
    sourceMaps: true
})
.then(function () {
    console.log("Build Complete")
});
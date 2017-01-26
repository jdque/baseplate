var Builder = require('systemjs-builder');

var builder = new Builder('src');

builder
.buildStatic('htmler.js', 'bin/htmler.js', {
    config: {
        defaultJSExtensions: true,
        packages: {
        }
    },
    externals: [],
    globalName: 'Htmler',
    globalDeps: {
    },
    minify: false,
    runtime: true,
    sourceMaps: true
})
.then(function () {
    console.log("Build Complete")
});
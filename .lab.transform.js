'use strict';

const Babel = require('@babel/core');

const internals = {
    GEN_COV_HTML: !!process.env.GEN_COV_HTML
};

// Adapted from https://github.com/hapijs/lab/issues/338 and
// https://github.com/nlf/lab-babel (which doesn't yet support Babel v7).
module.exports = [{
    ext: '.js',
    transform(content, filename) {

        if (filename.startsWith('node_modules')) {
            return content;
        }

        return Babel.transformSync(content, {
            auxiliaryCommentBefore: '$lab:coverage:off$',
            auxiliaryCommentAfter: '$lab:coverage:on$',
            filename,
            retainLines: !internals.GEN_COV_HTML,
            sourceFileName: filename,
            sourceMap: internals.GEN_COV_HTML ? 'inline' : false,
            sourceType: 'module'
        }).code;
    }
}];

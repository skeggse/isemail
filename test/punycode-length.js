'use strict';

// Load modules

const Lab = require('lab');
const Code = require('code');
const Punylength = require('../lib/punylength.js');
const Punycode = require('punycode');


// declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;

describe('punylength()', () => {

    it('should handle all-basic code points', (done) => {

        const domain = 'abcdefghijklmnopqrstuvwxyz0123456789';
        const length = Punylength(domain);
        const encoded = Punycode.encode(domain);

        expect(length).to.equal(encoded.length);
        done();
    });

    it('should handle a single 4-octet Unicode character', (done) => {

        const domain = '郵';
        const length = Punylength(domain);
        const encoded = Punycode.encode(domain);

        expect(length).to.equal(encoded.length);
        done();
    });

    it('should handle a single 2-octet Unicode character', (done) => {

        const domain = '\xFC';
        const length = Punylength(domain);
        const encoded = Punycode.encode(domain);

        expect(length).to.equal(encoded.length);
        done();
    });

    it('should handle unmatched low surrogates', (done) => {

        const domain = '\uDC00\uD834\uDF06\uDC00';
        const length = Punylength(domain);
        const encoded = Punycode.encode(domain);

        expect(length).to.equal(encoded.length);
        done();
    });

    it('should handle a long string with both ASCII and non-ASCII characters', (done) => {

        const domain = 'Willst du die Bl\xFCthe des fr\xFChen, die Fr\xFCchte des sp\xE4teren Jahres';
        const length = Punylength(domain);
        const encoded = Punycode.encode(domain);

        expect(length).to.equal(encoded.length);
        done();
    });

    it('should handle multiple Unicode characters', (done) => {

        const domain = '郵件';
        const length = Punylength(domain);
        const encoded = Punycode.encode(domain);

        expect(length).to.equal(encoded.length);
        done();
    });

    it('should handle duplicate Unicode characters', (done) => {

        const domain = '郵郵';
        const length = Punylength(domain);
        const encoded = Punycode.encode(domain);

        expect(length).to.equal(encoded.length);
        done();
    });

    // Test strings from https://tools.ietf.org/html/rfc3492#section-7.1
    // adjacent code points with small ∆s:

    it('should handle Arabic (Egyptian)', (done) => {

        const domain = '\u0644\u064A\u0647\u0645\u0627\u0628\u062A\u0643\u0644\u0645\u0648\u0634\u0639\u0631\u0628\u064A\u061F';
        const length = Punylength(domain);
        const encoded = Punycode.encode(domain);

        expect(length).to.equal(encoded.length);
        done();
    });

    it('should handle Chinese (simplified)', (done) => {

        const domain = '\u4ED6\u4EEC\u4E3A\u4EC0\u4E48\u4E0D\u8BF4\u4E2d\u6587';
        const length = Punylength(domain);
        const encoded = Punycode.encode(domain);

        expect(length).to.equal(encoded.length);
        done();
    });

    it('should handle Chinese (traditional)', (done) => {

        const domain = '\u4ED6\u5011\u7232\u4EC0\u9EBD\u4E0D\u8AAA\u4E2D\u6587';
        const length = Punylength(domain);
        const encoded = Punycode.encode(domain);

        expect(length).to.equal(encoded.length);
        done();
    });

    it('should handle Czech', (done) => {

        const domain = 'Pro\u010Dprost\u011Bnemluv\xED\u010Desky';
        const length = Punylength(domain);
        const encoded = Punycode.encode(domain);

        expect(length).to.equal(encoded.length);
        done();
    });

    it('should handle Hebrew', (done) => {

        const domain = '\u05DC\u05DE\u05D4\u05D4\u05DD\u05E4\u05E9\u05D5\u05D8\u05DC\u05D0\u05DE\u05D3\u05D1\u05E8\u05D9\u05DD\u05E2\u05D1\u05E8\u05D9\u05EA';
        const length = Punylength(domain);
        const encoded = Punycode.encode(domain);

        expect(length).to.equal(encoded.length);
        done();
    });

    it('should handle Hindi (Devanagari)', (done) => {

        const domain = '\u092F\u0939\u0932\u094B\u0917\u0939\u093F\u0928\u094D\u0926\u0940\u0915\u094D\u092F\u094B\u0902\u0928\u0939\u0940\u0902\u092C\u094B\u0932\u0938\u0915\u0924\u0947\u0939\u0948\u0902';
        const length = Punylength(domain);
        const encoded = Punycode.encode(domain);

        expect(length).to.equal(encoded.length);
        done();
    });

    it('should handle Japanese (kanji and hiragana)', (done) => {

        const domain = '\u306A\u305C\u307F\u3093\u306A\u65E5\u672C\u8A9E\u3092\u8A71\u3057\u3066\u304F\u308C\u306A\u3044\u306E\u304B';
        const length = Punylength(domain);
        const encoded = Punycode.encode(domain);

        expect(length).to.equal(encoded.length);
        done();
    });

    it('should handle Korean (Hangul syllables)', (done) => {

        const domain = '\uC138\uACC4\uC758\uBAA8\uB4E0\uC0AC\uB78C\uB4E4\uC774\uD55C\uAD6D\uC5B4\uB97C\uC774\uD574\uD55C\uB2E4\uBA74\uC5BC\uB9C8\uB098\uC88B\uC744\uAE4C';
        const length = Punylength(domain);
        const encoded = Punycode.encode(domain);

        expect(length).to.equal(encoded.length);
        done();
    });
});

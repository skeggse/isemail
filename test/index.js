'use strict';

// Load modules

const Lab = require('lab');
const Code = require('code');
const Isemail = require('..');
const Tests = require('./tests.json');


// declare internals

const internals = {
    defaultThreshold: 16
};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


// Diagnoses

const diag = Isemail.validate.diagnoses;


// Expectations

const expectations = Tests.map((value) => {

    value[1] = diag[value[1]];
    return value;
});


// Null characters aren't supported in JSON

expectations.push(['test@[\0', diag.errExpectingDTEXT]);
expectations.push(['(\0)test@example.com', diag.errExpectingCTEXT]);


const asciiTldExpectations = [
    // Test ASCII-only domains.
    ['shouldbe@invalid', diag.errUnknownTLD],
    ['shouldbe@INVALID', diag.errUnknownTLD],
    ['shouldbe@example.com', diag.valid],
    ['shouldbe@example.COM', diag.valid],
    // Regression test for https://github.com/hapijs/isemail/issues/170.
    ['apple-touch-icon-60x60@2x.png', diag.errUnknownTLD]
];

const unicodeTldExpectations = [
    // Test non-latin domains that have no (current) case-change support in unicode.
    ['shouldbe@XN--UNUP4Y', diag.valid],
    ['shouldbe@xn--unup4y', diag.valid],
    ['shouldbe@\u6e38\u620f', diag.valid],
    ['shouldbe@xn--tckwe', diag.errUnknownTLD],
    ['shouldbe@XN--TCKWE', diag.errUnknownTLD],
    ['shouldbe@\u30b3\u30e0', diag.errUnknownTLD],
    // Test non-latin domains that have current case-change support in unicode.
    ['shouldbe@verm\u00f6gensberatung', diag.valid],
    ['shouldbe@xn--vermgensberatung-pwb', diag.valid],
    ['shouldbe@XN--VERMGENSBERATUNG-PWB', diag.valid],
    ['shouldbe@VERM\u00d6GENSBERATUNG', diag.errUnknownTLD],
    ['shouldbe@xn--vermgensberatung-5gb', diag.errUnknownTLD],
    ['shouldbe@XN--VERMGENSBERATUNG-5GB', diag.errUnknownTLD]
];

describe('validate()', () => {

    it('should reject non-strings', () => {

        expect(() => Isemail.validate()).to.throw(TypeError);
        expect(() => Isemail.validate(NaN)).to.throw(TypeError);
        // This should throw even though it's a representation of a string.
        // Sneak around lab's new primtive rule by assigning String to a local.
        const Str = String;
        expect(() => Isemail.validate(new Str('valid@hapijs.com'))).to.throw(TypeError);
    });

    it('should check options.tldWhitelist', () => {

        expect(Isemail.validate('person@top', {
            tldWhitelist: 'top'
        })).to.equal(true);

        expect(Isemail.validate('person@top', {
            tldWhitelist: ['com']
        })).to.equal(false);

        expect(Isemail.validate('person@top', {
            tldWhitelist: new Set(['top'])
        })).to.equal(true);

        expect(Isemail.validate('person@top', {
            tldWhitelist: new Map([['top', false]])
        })).to.equal(true);

        expect(Isemail.validate('person@top', {
            tldWhitelist: { com: true }
        })).to.equal(false);

        expect(() => {

            Isemail.validate('', {
                tldWhitelist: 77
            });
        }).to.throw(/tldWhitelist/);
    });

    it('should check options.tldBlacklist', () => {

        expect(Isemail.validate('person@top', {
            tldBlacklist: 'top'
        })).to.equal(false);

        expect(Isemail.validate('person@top', {
            tldBlacklist: ['com']
        })).to.equal(true);

        expect(Isemail.validate('person@top', {
            tldBlacklist: { com: true }
        })).to.equal(true);

        expect(() => {

            Isemail.validate('', {
                tldBlacklist: 77
            });
        }).to.throw(/tldBlacklist/);
    });

    describe('with options.allowUnicode', () => {

        it('should accept a pure ASCII email address when false', () => {

            expect(Isemail.validate('pure@ascii.org', {
                allowUnicode: false
            })).to.equal(true);
        });

        it('should reject email addresses containing unicode when false', () => {

            expect(Isemail.validate('üñïçø∂é@example.com', {
                allowUnicode: false
            })).to.equal(false);

            expect(Isemail.validate('unicode@exãmple.com', {
                allowUnicode: false
            })).to.equal(false);
        });

        describe('in combination with errorLevel', () => {

            it('should return the right diagnosis when allowUnicode is false', () => {

                expect(Isemail.validate('üñïçø∂é@example.com', {
                    allowUnicode: false,
                    errorLevel: 8
                })).to.equal(25);
            });
        });
    });

    it('should check options.minDomainAtoms', () => {

        expect(() => {

            Isemail.validate('person@top', {
                minDomainAtoms: -1
            });
        }).to.throw(/minDomainAtoms/);

        expect(() => {

            Isemail.validate('person@top', {
                minDomainAtoms: 1.5
            });
        }).to.throw(/minDomainAtoms/);
    });

    it('should use options.errorLevel', () => {

        expect(Isemail.validate('person@123', {
            errorLevel: diag.rfc5321TLDNumeric + 1
        })).to.equal(0);

        expect(Isemail.validate('person@123', {
            errorLevel: diag.rfc5321TLDNumeric
        })).to.equal(diag.rfc5321TLDNumeric);
    });

    it('should ignore diagnoses in excludeDiagnoses', () => {

        expect(() => {

            Isemail.validate('person@123', { excludeDiagnoses: true });
        }).to.throw(TypeError, /excludeDiagnoses/);

        expect(() => {

            Isemail.validate('person@123', {
                excludeDiagnoses: {
                    [diag.rfc5321TLDNumeric]: true
                }
            });
        }).to.throw(TypeError, /excludeDiagnoses/);

        expect(Isemail.validate('person@127.0.0.1', {
            excludeDiagnoses: [diag.rfc5321AddressLiteral],
            errorLevel: diag.rfc5321TLDNumeric
        })).to.equal(diag.rfc5321TLDNumeric);

        expect(Isemail.validate('person@[127.0.0.1]', {
            excludeDiagnoses: [diag.rfc5321AddressLiteral],
            errorLevel: diag.rfc5321TLDNumeric
        })).to.equal(diag.valid);

        expect(Isemail.validate('person@[127.0.0.1]', {
            excludeDiagnoses: new Set([diag.rfc5321AddressLiteral]),
            errorLevel: diag.rfc5321TLDNumeric
        })).to.equal(diag.valid);

        expect(Isemail.validate('person@[127.0.0.1]', {
            excludeDiagnoses: [],
            errorLevel: diag.rfc5321TLDNumeric
        })).to.equal(diag.rfc5321AddressLiteral);
    });

    it('should handle omitted options', () => {

        expect(Isemail.validate(expectations[0][0])).to.equal(expectations[0][1] < internals.defaultThreshold);
    });

    it('should permit address literals with multiple required domain atoms', () => {

        expect(Isemail.validate('joe@[IPv6:2a00:1450:4001:c02::1b]', {
            minDomainAtoms: 2,
            errorLevel: true
        })).to.equal(diag.rfc5321AddressLiteral);

        // Do not provide the same treatment to mixed domain parts.
        expect(Isemail.validate('joe@[IPv6:2a00:1450:4001:c02::1b].com', {
            minDomainAtoms: 3,
            errorLevel: true
        })).to.equal(diag.errDomainTooShort);
    });

    expectations.forEach((obj, i) => {

        const email = obj[0];
        const result = obj[1];
        it('should handle test ' + (i + 1), () => {

            const res = Isemail.validate(email, {
                errorLevel: 0
            });
            expect(res).to.equal(result);
        });
    });

    asciiTldExpectations.forEach((obj, i) => {

        const email = obj[0];
        const result = obj[1];

        it('should handle tld test ' + (i + 1), () => {

            expect(Isemail.validate(email, {
                errorLevel: 0,
                tldWhitelist: { com: true }
            })).to.equal(result);

            expect(Isemail.validate(email, {
                errorLevel: 0,
                tldWhitelist: ['com']
            })).to.equal(result);

            expect(Isemail.validate(email, {
                errorLevel: 0,
                tldBlacklist: { invalid: true, png: true }
            })).to.equal(result);

            expect(Isemail.validate(email, {
                errorLevel: 0,
                tldBlacklist: ['invalid', 'png']
            })).to.equal(result);

        });
    });

    unicodeTldExpectations.forEach((obj, i) => {

        const email = obj[0];
        const result = obj[1];

        it('should handle unicode tld test (' + email + ') ' + (i + 1), () => {

            expect(Isemail.validate(email, {
                errorLevel: 0,
                tldWhitelist: ['xn--unup4y', 'xn--vermgensberatung-pwb']
            })).to.equal(result);

            expect(Isemail.validate(email, {
                errorLevel: 0,
                tldWhitelist: ['XN--UNUP4Y', 'XN--VERMGENSBERATUNG-PWB']
            })).to.equal(result);

            expect(Isemail.validate(email, {
                errorLevel: 0,
                tldWhitelist: ['\u6e38\u620f', 'verm\u00f6gensberatung']
            })).to.equal(result);
        });
    });

    it('should handle domain atom test 1', () => {

        expect(Isemail.validate('shouldbe@invalid', {
            errorLevel: 0,
            minDomainAtoms: 2
        })).to.equal(diag.errDomainTooShort);
    });

    it('should handle domain atom test 2', () => {

        expect(Isemail.validate('valid@example.com', {
            errorLevel: 0,
            minDomainAtoms: 2
        })).to.equal(diag.valid);
    });
});

describe('normalize', () => {

    const normalizeExpectations = [
        ['man\u0303ana.com', 'mañana.com']
    ];

    normalizeExpectations.forEach((normalizingPair) => {

        it('should properly normalize international characters', () => {

            const normal = normalizingPair[1];
            const email = normalizingPair[0];
            const normalizedEmail = Isemail.normalize(email);

            expect(email).to.not.equal(normal);
            expect(normalizedEmail).to.equal(normal);
        });
    });
});

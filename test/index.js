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


const tldExpectations = [
    ['shouldbe@invalid', diag.errUnknownTLD],
    ['shouldbe@example.com', diag.valid],
    ['shouldbe@example.COM', diag.valid]
];

describe('validate()', () => {

    it('should check options.tldWhitelist', () => {

        expect(Isemail.validate('person@top', {
            tldWhitelist: 'top'
        })).to.equal(true);

        expect(Isemail.validate('person@top', {
            tldWhitelist: ['com']
        })).to.equal(false);

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

    it('should handle omitted options', () => {

        expect(Isemail.validate(expectations[0][0])).to.equal(expectations[0][1] < internals.defaultThreshold);
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

    tldExpectations.forEach((obj, i) => {

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
                tldBlacklist: { invalid: true }
            })).to.equal(result);

            expect(Isemail.validate(email, {
                errorLevel: 0,
                tldBlacklist: ['invalid']
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

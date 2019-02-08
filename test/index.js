// @flow strict

// Load modules

import Lab from 'lab';
import Code from 'code';

import Diagnoses from '../lib/diagnoses';
import * as Isemail from '../lib/index';
import Parser, { type ParsedAddress, type ParserOptions } from '../lib/parser';
import Tests from './tests.json';
import * as Validation from '../lib/validation';


// declare internals

const internals = {};


internals.defaultThreshold = 16;


internals.expectParse = function (email: string, options: ParserOptions | void): {| diagnoses: Diagnoses, parser: Parser, parse: ParsedAddress |} {

    const diagnoses = new Diagnoses();
    const parser = new Parser(email, diagnoses, options);
    const parse = parser.parse();

    if (!parse) {
        throw new Error('expected a valid parse but did not identify the fundamental address components');
    }

    return { diagnoses, parser, parse };
};


// Test shortcuts

export const lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


// Diagnoses

const diag = Isemail.validate.diagnoses;

internals.findDiagnosisName = function (diagnosis: number) {

    const [name] = Object.entries(diag).find(([, id]) => id === diagnosis) || [];
    return name;
};

internals.formatDiagnosis = function (diagnosis: number) {

    return `${diagnosis} (${internals.findDiagnosisName(diagnosis) || '<unknown>'})`;
};


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

        const PermissiveIsemail: any = Isemail;
        expect(() => PermissiveIsemail.validate()).to.throw(TypeError);
        expect(() => PermissiveIsemail.validate(NaN)).to.throw(TypeError);
        // This should throw even though it's a representation of a string.
        // Sneak around lab's new primitive rule by assigning String to a local.
        const Str = String;
        expect(() => PermissiveIsemail.validate(new Str('valid@hapijs.com'))).to.throw(TypeError);
    });

    it('should check options.tldWhitelist', () => {

        expect(Isemail.isValid('person@top', {
            tldWhitelist: 'top'
        })).to.equal(true);

        expect(Isemail.isValid('person@top', {
            tldWhitelist: ['com']
        })).to.equal(false);

        expect(Isemail.isValid('person@top', {
            tldWhitelist: new Set(['top'])
        })).to.equal(true);

        expect(Isemail.isValid('person@top', {
            tldWhitelist: new Map([['top', false]])
        })).to.equal(true);

        expect(Isemail.isValid('person@top', {
            tldWhitelist: { com: true }
        })).to.equal(false);

        const PermissiveIsemail: any = Isemail;
        expect(() => {

            PermissiveIsemail.validate('', {
                tldWhitelist: 77
            });
        }).to.throw(/tldWhitelist/);
    });

    it('should check options.tldBlacklist', () => {

        expect(Isemail.isValid('person@top', {
            tldBlacklist: 'top'
        })).to.equal(false);

        expect(Isemail.isValid('person@top', {
            tldBlacklist: ['com']
        })).to.equal(true);

        expect(Isemail.isValid('person@top', {
            tldBlacklist: { com: true }
        })).to.equal(true);

        expect(Isemail.isValid('person@top', {
            // $FlowFixMe: Flow does not yet have full Symbol support.
            tldBlacklist: ['com'][Symbol.iterator]()
        })).to.equal(true);

        const PermissiveIsemail: any = Isemail;
        expect(() => {

            PermissiveIsemail.validate('', {
                tldBlacklist: 77
            });
        }).to.throw(/tldBlacklist/);
    });

    describe('with options.allowUnicode', () => {

        it('should accept a pure ASCII email address when false', () => {

            expect(Isemail.isValid('pure@ascii.org', {
                allowUnicode: false
            })).to.equal(true);
        });

        it('should reject email addresses containing unicode when false', () => {

            expect(Isemail.isValid('üñïçø∂é@example.com', {
                allowUnicode: false
            })).to.equal(false);

            expect(Isemail.isValid('unicode@exãmple.com', {
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

        const PermissiveIsemail: any = Isemail;
        expect(() => {

            PermissiveIsemail.validate('person@123', { excludeDiagnoses: true });
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

        expect(Isemail.validate('"person"@123', {
            excludeDiagnoses: [diag.rfc5321QuotedString]
        })).to.equal(diag.rfc5321TLDNumeric);

        expect(Isemail.validate('"person"@abc(comment).123', {
            excludeDiagnoses: [diag.cfwsComment]
        })).to.equal(diag.rfc5321QuotedString);

        expect(Isemail.validate('"person"@(yes)abc(comment).123', {
            excludeDiagnoses: [diag.rfc5321TLDNumeric, diag.deprecatedCFWSNearAt]
        })).to.equal(diag.cfwsComment);
    });

    it('should handle omitted options', () => {

        expect(Isemail.isValid(expectations[0][0])).to.equal(expectations[0][1] < internals.defaultThreshold);
    });

    it('should permit address literals with multiple required domain atoms', () => {

        expect(Isemail.validate('joe@[IPv6:2a00:1450:4001:c02::1b]', {
            minDomainAtoms: 2
        })).to.equal(diag.rfc5321AddressLiteral);

        // Do not provide the same treatment to mixed domain parts.
        const { diagnoses, parse } = internals.expectParse('joe@[IPv6:2a00:1450:4001:c02::1b].com');
        Validation.optionsValidation(parse, diagnoses, {
            minDomainAtoms: 3
        });

        expect(diagnoses.hasDiagnosis(diag.errDomainTooShort)).to.equal(true);
        expect(diagnoses.hasDiagnosis(diag.errDotAfterDomainLiteral)).to.equal(true);
    });

    expectations.forEach((obj, i) => {

        const [email, expectedResult] = obj;

        it('should handle test ' + (i + 1), () => {

            const res = Isemail.validate(email, {
                errorLevel: 0
            });
            if (res !== expectedResult) {
                throw new Error(`Expected diagnosis ${internals.formatDiagnosis(expectedResult)}, but got ${internals.formatDiagnosis(res)}`);
            }
        });
    });

    asciiTldExpectations.forEach((obj, i) => {

        const [email, result] = obj;

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

        const [email, result] = obj;

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

    it('should check domain atoms', () => {

        const PermissiveIsemail: any = Isemail;
        expect(() => {

            PermissiveIsemail.validate('shouldbe@invalid', {
                minDomainAtoms: true
            });
        }).to.throw(TypeError, /minDomainAtoms/);

        expect(() => {

            PermissiveIsemail.validate('shouldbe@invalid', {
                minDomainAtoms: 0.5
            });
        }).to.throw(TypeError, /minDomainAtoms/);

        expect(Isemail.validate('shouldbe@invalid', {
            errorLevel: 0,
            minDomainAtoms: 2
        })).to.equal(diag.errDomainTooShort);

        expect(Isemail.validate('valid@example.com', {
            errorLevel: 0,
            minDomainAtoms: 2
        })).to.equal(diag.valid);

        expect(Isemail.validate('valid@', {
            errorLevel: 0,
            minDomainAtoms: 2
        })).to.equal(diag.errNoDomain);
    });
});

describe('normalize', () => {

    const normalizeExpectations = [
        ['man\u0303ana.com', 'mañana.com']
    ];

    normalizeExpectations.forEach((normalizingPair) => {

        it('should properly normalize international characters', () => {

            const [email, normal] = normalizingPair;
            const normalizedEmail = Isemail.normalize(email);

            expect(email).to.not.equal(normal);
            expect(normalizedEmail).to.equal(normal);
        });
    });
});

describe('parser', () => {

    it('should not downgrade from a quoted string by default', () => {

        const { parse } = internals.expectParse('"human"@example.com');
        expect(parse.localParts).to.equal(['"human"']);
        expect(parse.local).to.equal('"human"');
    });

    it('should optionally downgrade from a quoted string when none is necessary', () => {

        const { parse } = internals.expectParse('"human"@example.com', {
            normalizeUnnecessaryQuoted: true
        });

        expect(parse.localParts).to.equal(['human']);
        expect(parse.local).to.equal('human');
    });

    it('should not downgrade empty quoted string', () => {

        const { parse } = internals.expectParse('""@example.com', {
            normalizeUnnecessaryQuoted: true
        });
        expect(parse.localParts).to.equal(['""']);
        expect(parse.local).to.equal('""');
    });
});

describe('validation', () => {

    it('should report no domain and too short', () => {

        const { diagnoses, parse } = internals.expectParse('invalid@');
        Validation.optionsValidation(parse, diagnoses, {
            minDomainAtoms: 1
        });

        expect(diagnoses.hasDiagnosis(diag.errDomainTooShort)).to.equal(true);
        expect(diagnoses.hasDiagnosis(diag.errNoDomain)).to.equal(true);
    });

    it('should report no domain and an invalid TLD with a whitelist', () => {

        const { diagnoses, parse } = internals.expectParse('invalid@');
        Validation.optionsValidation(parse, diagnoses, {
            // $FlowFixMe: https://github.com/facebook/flow/issues/7458
            tldWhitelist: ['com']
        });

        expect(diagnoses.hasDiagnosis(diag.errUnknownTLD)).to.equal(true);
        expect(diagnoses.hasDiagnosis(diag.errNoDomain)).to.equal(true);
    });

    it('should report no domain but valid TLD with a blacklist', () => {

        const { diagnoses, parse } = internals.expectParse('invalid@');
        Validation.optionsValidation(parse, diagnoses, {
            // $FlowFixMe: https://github.com/facebook/flow/issues/7458
            tldBlacklist: ['com']
        });

        expect(diagnoses.hasDiagnosis(diag.errUnknownTLD)).to.equal(false);
        expect(diagnoses.hasDiagnosis(diag.errNoDomain)).to.equal(true);
    });
});

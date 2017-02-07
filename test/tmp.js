'use strict';

// Load modules

const Lab = require('lab');
const Code = require('code');
const Rewire = require('rewire');
const Isemail = Rewire('..');

// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;

// declare internals

const internals = {};

// Dns rewire stub

const dns_stub = {
    resolveMx: (domainName, cb) => {

        internals.punyDomain = domainName;

        return cb(null, [domainName]);
    }
};

Isemail.__set__('Dns', dns_stub);

describe('validate() international domains', () => {

    it('should punycode domains', (done) => {

        Isemail.validate('伊昭傑@郵件.商務', {
            errorLevel: 0,
            checkDNS: true
        }, () => {

            expect(internals.punyDomain).to.equal('xn--5nqv22n.xn--lhr59c');
            done();
        });
    });
});

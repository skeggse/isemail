'use strict';

// Load modules

const Lab = require('lab');
const Code = require('code');
const Proxyquire = require('proxyquire');
const Punycode = require('punycode');

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

const Isemail = Proxyquire('..', { dns: dns_stub });

describe('validate() international domains', () => {

    it('should punycode domains', (done) => {

        Isemail.validate('伊昭傑@郵件.商務', {
            errorLevel: 0,
            checkDNS: true
        }, () => {

            expect(Punycode.toUnicode(internals.punyDomain)).to.equal('郵件.商務');
            done();
        });
    });

    it('should normalize domains', (done) => {

        Isemail.validate('test@man\u0303ana.com', {
            errorLevel: 0,
            checkDNS: true
        }, () => {

            expect(Punycode.toUnicode(internals.punyDomain)).to.equal('mañana.com');
            done();
        });
    });
});

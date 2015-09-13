var expect = require('chai').expect;
var isEmail = require('..');

// diagnoses
var diag = isEmail.diagnoses;

// expectations
var expectations = [
    ['', diag.errNoDomain],
    ['test', diag.errNoDomain],
    ['@', diag.errNoLocalPart],
    ['test@', diag.errNoDomain],
    ['test@io', diag.valid],
    ['@io', diag.errNoLocalPart],
    ['@iana.org', diag.errNoLocalPart],
    ['test@iana.org', diag.valid],
    ['test@nominet.org.uk', diag.valid],
    ['test@about.museum', diag.valid],
    ['a@iana.org', diag.valid],
    ['test@e.com', diag.dnsWarnNoRecord],
    ['test@iana.a', diag.dnsWarnNoRecord],
    ['test.test@iana.org', diag.valid],
    ['.test@iana.org', diag.errDotStart],
    ['test.@iana.org', diag.errDotEnd],
    ['test..iana.org', diag.errConsecutiveDots],
    ['test_exa-mple.com', diag.errNoDomain],
    ['!#$%&`*+/=?^`{|}~@iana.org', diag.valid],
    ['test\\@test@iana.org', diag.errExpectingATEXT],
    ['123@iana.org', diag.valid],
    ['test@123.com', diag.valid],
    ['test@iana.123', diag.rfc5321TLDNumeric],
    ['test@255.255.255.255', diag.rfc5321TLDNumeric],
    ['abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghiklm@iana.org', diag.valid],
    ['abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghiklmn@iana.org', diag.rfc5322LocalTooLong],
    ['test@abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghiklm', diag.rfc5322LabelTooLong],
    ['test@abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghikl.com', diag.dnsWarnNoRecord],
    ['test@abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghiklm.com', diag.rfc5322LabelTooLong],
    ['test@mason-dixon.com', diag.valid],
    ['test@-iana.org', diag.errDomainHyphenStart],
    ['test@iana-.com', diag.errDomainHyphenEnd],
    //['test@aaad.com', diag.dnsWarnNoMXRecord],
    ['test@iana.co-uk', diag.dnsWarnNoRecord],
    ['test@.iana.org', diag.errDotStart],
    ['test@iana.org.', diag.errDotEnd],
    ['test@iana..com', diag.errConsecutiveDots],
    ['a@a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v.w.x.y.z.a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v.w.x.y.z.a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v.w.x.y.z.a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v.w.x.y.z.a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v', diag.dnsWarnNoRecord],
    ['abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghiklm@abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghikl.abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghikl.abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghi', diag.dnsWarnNoRecord],
    ['abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghiklm@abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghikl.abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghikl.abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghij', diag.rfc5322TooLong],
    ['a@abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghikl.abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghikl.abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghikl.abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefg.hij', diag.rfc5322TooLong],
    ['a@abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghikl.abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghikl.abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghikl.abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefg.hijk', diag.rfc5322DomainTooLong],
    ['"test"@iana.org', diag.rfc5321QuotedString],
    ['""@iana.org', diag.rfc5321QuotedString],
    ['"""@iana.org', diag.errExpectingATEXT],
    ['"\\a"@iana.org', diag.rfc5321QuotedString],
    ['"\\""@iana.org', diag.rfc5321QuotedString],
    ['"\\"@iana.org', diag.errUnclosedQuotedString],
    ['"\\\\"@iana.org', diag.rfc5321QuotedString],
    ['test"@iana.org', diag.errExpectingATEXT],
    ['"test@iana.org', diag.errUnclosedQuotedString],
    ['"test"test@iana.org', diag.errATEXTAfterQS],
    ['test"text"@iana.org', diag.errExpectingATEXT],
    ['"test""test"@iana.org', diag.errExpectingATEXT],
    ['"test"."test"@iana.org', diag.deprecatedLocalPart],
    ['"test\\ test"@iana.org', diag.rfc5321QuotedString],
    ['"test".test@iana.org', diag.deprecatedLocalPart],
    ['"test\0"@iana.org', diag.errExpectingQTEXT],
    ['"test\\\0"@iana.org', diag.deprecatedQP],
    ['"test\r\n test"@iana.org', diag.cfwsFWS],
    ['"abcdefghijklmnopqrstuvwxyz abcdefghijklmnopqrstuvwxyz abcdefghj"@iana.org', diag.rfc5322LocalTooLong],
    ['"abcdefghijklmnopqrstuvwxyz abcdefghijklmnopqrstuvwxyz abcdefg\\h"@iana.org', diag.rfc5322LocalTooLong],
    ['test@[255.255.255.255]', diag.rfc5321AddressLiteral],
    ['test@a[255.255.255.255]', diag.errExpectingATEXT],
    ['test@[255.255.255]', diag.rfc5322DomainLiteral],
    ['test@[255.255.255.255.255]', diag.rfc5322DomainLiteral],
    ['test@[255.255.255.256]', diag.rfc5322DomainLiteral],
    ['test@[1111:2222:3333:4444:5555:6666:7777:8888]', diag.rfc5322DomainLiteral],
    ['test@[IPv6:1111:2222:3333:4444:5555:6666:7777]', diag.rfc5322IPv6GroupCount],
    ['test@[IPv6:1111:2222:3333:4444:5555:6666:7777:8888]', diag.rfc5321AddressLiteral],
    ['test@[IPv6:1111:2222:3333:4444:5555:6666:7777:8888:9999]', diag.rfc5322IPv6GroupCount],
    ['test@[IPv6:1111:2222:3333:4444:5555:6666:7777:888G]', diag.rfc5322IPv6BadCharacter],
    ['test@[IPv6:1111:2222:3333:4444:5555:6666::8888]', diag.deprecatedIPv6],
    ['test@[IPv6:1111:2222:3333:4444:5555::8888]', diag.rfc5321AddressLiteral],
    ['test@[IPv6:1111:2222:3333:4444:5555:6666::7777:8888]', diag.rfc5322IPv6MaxGroups],
    ['test@[IPv6::3333:4444:5555:6666:7777:8888]', diag.rfc5322IPv6ColonStart],
    ['test@[IPv6:::3333:4444:5555:6666:7777:8888]', diag.rfc5321AddressLiteral],
    ['test@[IPv6:1111::4444:5555::8888]', diag.rfc5322IPv62x2xColon],
    ['test@[IPv6:::]', diag.rfc5321AddressLiteral],
    ['test@[IPv6:1111:2222:3333:4444:5555:255.255.255.255]', diag.rfc5322IPv6GroupCount],
    ['test@[IPv6:1111:2222:3333:4444:5555:6666:255.255.255.255]', diag.rfc5321AddressLiteral],
    ['test@[IPv6:1111:2222:3333:4444:5555:6666:7777:255.255.255.255]', diag.rfc5322IPv6GroupCount],
    ['test@[IPv6:1111:2222:3333:4444::255.255.255.255]', diag.rfc5321AddressLiteral],
    ['test@[IPv6:1111:2222:3333:4444:5555:6666::255.255.255.255]', diag.rfc5322IPv6MaxGroups],
    ['test@[IPv6:1111:2222:3333:4444:::255.255.255.255]', diag.rfc5322IPv62x2xColon],
    ['test@[IPv6::255.255.255.255]', diag.rfc5322IPv6ColonStart],
    [' test @iana.org', diag.deprecatedCFWSNearAt],
    ['test@ iana .com', diag.deprecatedCFWSNearAt],
    ['test . test@iana.org', diag.deprecatedFWS],
    ['\r\n test@iana.org', diag.cfwsFWS],
    ['\r\n \r\n test@iana.org', diag.deprecatedFWS],
    ['(comment)test@iana.org', diag.cfwsComment],
    ['((comment)test@iana.org', diag.errUnclosedComment],
    ['(comment(comment))test@iana.org', diag.cfwsComment],
    ['test@(comment)iana.org', diag.deprecatedCFWSNearAt],
    ['test(comment)test@iana.org', diag.errATEXTAfterCFWS],
    ['test@(comment)[255.255.255.255]', diag.deprecatedCFWSNearAt],
    ['(comment)abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghiklm@iana.org', diag.cfwsComment],
    ['test@(comment)abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghikl.com', diag.deprecatedCFWSNearAt],
    ['(comment)test@abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghik.abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghik.abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijk.abcdefghijklmnopqrstuvwxyzabcdefghijk.abcdefghijklmnopqrstu', diag.cfwsComment],
    ['test@iana.org\n', diag.errExpectingATEXT],
    ['test@xn--hxajbheg2az3al.xn--jxalpdlp', diag.dnsWarnNoRecord],
    ['xn--test@iana.org', diag.valid],
    ['test@iana.org-', diag.errDomainHyphenEnd],
    ['"test@iana.org', diag.errUnclosedQuotedString],
    ['(test@iana.org', diag.errUnclosedComment],
    ['test@(iana.org', diag.errUnclosedComment],
    ['test@[1.2.3.4', diag.errUnclosedDomainLiteral],
    ['"test\\"@iana.org', diag.errUnclosedQuotedString],
    ['(comment\\)test@iana.org', diag.errUnclosedComment],
    ['test@iana.org(comment\\)', diag.errUnclosedComment],
    ['test@iana.org(comment\\', diag.errBackslashEnd],
    ['test@[RFC-5322-domain-literal]', diag.rfc5322DomainLiteral],
    ['test@[RFC-5322]-domain-literal]', diag.errATEXTAfterDomainLiteral],
    ['test@[RFC-5322-[domain-literal]', diag.errExpectingDTEXT],
    ['test@[RFC-5322-\\\x07-domain-literal]', diag.rfc5322DomainLiteralOBSDText],
    ['test@[RFC-5322-\\\t-domain-literal]', diag.rfc5322DomainLiteralOBSDText],
    ['test@[RFC-5322-\\]-domain-literal]', diag.rfc5322DomainLiteralOBSDText],
    ['test@[RFC-5322-\x7f-domain-literal]', diag.rfc5322DomainLiteralOBSDText],
    ['test@[RFC-5322-domain-literal\\]', diag.errUnclosedDomainLiteral],
    ['test@[RFC-5322-domain-literal\\', diag.errBackslashEnd],
    ['test@[RFC 5322 domain literal]', diag.rfc5322DomainLiteral],
    ['test@[RFC-5322-domain-literal] (comment)', diag.rfc5322DomainLiteral],
    ['\x7f@iana.org', diag.errExpectingATEXT],
    ['test@\x7f.org', diag.errExpectingATEXT],
    ['"\x7f"@iana.org', diag.deprecatedQTEXT],
    ['"\\\x7f"@iana.org', diag.deprecatedQP],
    ['(\x7f)test@iana.org', diag.deprecatedCTEXT],
    ['test@iana.org\r', diag.errCRNoLF],
    ['\rtest@iana.org', diag.errCRNoLF],
    ['"\rtest"@iana.org', diag.errCRNoLF],
    ['(\r)test@iana.org', diag.errCRNoLF],
    ['test@iana.org(\r)', diag.errCRNoLF],
    ['\ntest@iana.org', diag.errExpectingATEXT],
    ['"\n"@iana.org', diag.errExpectingQTEXT],
    ['"\\\n"@iana.org', diag.deprecatedQP],
    ['(\n)test@iana.org', diag.errExpectingCTEXT],
    ['\x07@iana.org', diag.errExpectingATEXT],
    ['test@\x07.org', diag.errExpectingATEXT],
    ['"\x07"@iana.org', diag.deprecatedQTEXT],
    ['"\\\x07"@iana.org', diag.deprecatedQP],
    ['(\x07)test@iana.org', diag.deprecatedCTEXT],
    ['\r\ntest@iana.org', diag.errFWSCRLFEnd],
    ['\r\n \r\ntest@iana.org', diag.errFWSCRLFEnd],
    [' \r\ntest@iana.org', diag.errFWSCRLFEnd],
    [' \r\n test@iana.org', diag.cfwsFWS],
    [' \r\n \r\ntest@iana.org', diag.errFWSCRLFEnd],
    [' \r\n\r\ntest@iana.org', diag.errFWSCRLFx2],
    [' \r\n\r\n test@iana.org', diag.errFWSCRLFx2],
    ['test@iana.org\r\n ', diag.cfwsFWS],
    ['test@iana.org\r\n \r\n ', diag.deprecatedFWS],
    ['test@iana.org\r\n', diag.errFWSCRLFEnd],
    ['test@iana.org \r', diag.errCRNoLF],
    ['test@iana.org\r\n \r\n', diag.errFWSCRLFEnd],
    ['test@iana.org \r\n', diag.errFWSCRLFEnd],
    ['test@iana.org \r\n ', diag.cfwsFWS],
    ['test@iana.org \r\n \r\n', diag.errFWSCRLFEnd],
    ['test@iana.org \r\n\r\n', diag.errFWSCRLFx2],
    ['test@iana.org \r\n\r\n ', diag.errFWSCRLFx2],
    ['test@iana. org', diag.deprecatedFWS],
    ['test@[\r', diag.errCRNoLF],
    ['test@[\r\n', diag.errFWSCRLFEnd],
    [' test@iana.org', diag.cfwsFWS],
    ['test@iana.org ', diag.cfwsFWS],
    ['test@[IPv6:1::2:]', diag.rfc5322IPv6ColonEnd],
    ['"test\\©"@iana.org', diag.errExpectingQPair],
    ['test@iana/icann.org', diag.rfc5322Domain],
    ['test.(comment)test@iana.org', diag.deprecatedComment],
    ['test@iana.(comment)org', diag.deprecatedComment],
    ['test@iana(comment)iana.org', diag.errATEXTAfterCFWS],
    ['(comment\r\n comment)test@iana.org', diag.cfwsFWS],
    ['test@org', diag.rfc5321TLD],
    ['test@example.com', diag.dnsWarnNoMXRecord],
    ['test@nic.no', diag.dnsWarnNoRecord]
];

var tldExpectations = [
    ['shouldbe@invalid', diag.errUnknownTLD],
    ['shouldbe@example.com', diag.valid]
];

describe('isEmail', function () {

    expectations.forEach(function (obj, i) {

        var email = obj[0], result = obj[1];
        it('should handle test ' + (i + 1), function (done) {

            isEmail(email, {
                errorLevel: 0,
                checkDNS: true
            }, function (res) {

                expect(res).to.equal(result);
                done();
            });
        });
    });

    tldExpectations.forEach(function (obj, i) {

        var email = obj[0];
        var result = obj[1];

        it('should handle tld test ' + (i + 1), function () {

            expect(isEmail(email, {
                errorLevel: 0,
                tldWhitelist: {
                    com: true
                }
            })).to.equal(result);

            expect(isEmail(email, {
                errorLevel: 0,
                tldWhitelist: ['com']
            })).to.equal(result);
        });
    });

    it('should handle domain atom test 1', function () {

        expect(isEmail('shouldbe@invalid', {
            errorLevel: 0,
            minDomainAtoms: 2
        })).to.equal(diag.errDomainTooShort);
    });

    it('should handle domain atom test 2', function () {

        expect(isEmail('valid@example.com', {
            errorLevel: 0,
            minDomainAtoms: 2
        })).to.equal(diag.valid);
    });
});

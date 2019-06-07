// @flow strict

export const categories = {
    valid: 1,
    dnsWarn: 7,
    rfc5321: 15,
    cfws: 31,
    deprecated: 63,
    rfc5322: 127,
    error: 255
};

export type CategoryName = $Keys<typeof categories>;

export const diagnoses = {

    // Address is valid

    valid: 0,

    // Address is valid for SMTP but has unusual elements

    rfc5321TLD: 9,
    rfc5321TLDNumeric: 10,
    rfc5321QuotedString: 11,
    rfc5321AddressLiteral: 12,

    // Address is valid for message, but must be modified for envelope

    cfwsComment: 17,
    cfwsFWS: 18,

    // Address contains non-ASCII when the allowUnicode option is false
    // Has to be > internals.defaultThreshold so that it's rejected
    // without an explicit errorLevel:
    undesiredNonAscii: 25,

    // Address contains deprecated elements, but may still be valid in some contexts

    deprecatedLocalPart: 33,
    deprecatedFWS: 34,
    deprecatedQTEXT: 35,
    deprecatedQP: 36,
    deprecatedComment: 37,
    deprecatedCTEXT: 38,
    deprecatedIPv6: 39,
    deprecatedCFWSNearAt: 49,

    // Address is only valid according to broad definition in RFC 5322, but is otherwise invalid

    rfc5322Domain: 65,
    rfc5322TooLong: 66,
    rfc5322LocalTooLong: 67,
    rfc5322DomainTooLong: 68,
    rfc5322LabelTooLong: 69,
    rfc5322DomainLiteral: 70,
    rfc5322DomainLiteralOBSDText: 71,
    rfc5322IPv6GroupCount: 72,
    rfc5322IPv62x2xColon: 73,
    rfc5322IPv6BadCharacter: 74,
    rfc5322IPv6MaxGroups: 75,
    rfc5322IPv6ColonStart: 76,
    rfc5322IPv6ColonEnd: 77,

    // Address is invalid for any purpose

    errExpectingDTEXT: 129,
    errNoLocalPart: 130,
    errNoDomain: 131,
    errConsecutiveDots: 132,
    errATEXTAfterCFWS: 133,
    errATEXTAfterQS: 134,
    errATEXTAfterDomainLiteral: 135,
    errExpectingQPair: 136,
    errExpectingATEXT: 137,
    errExpectingQTEXT: 138,
    errExpectingCTEXT: 139,
    errBackslashEnd: 140,
    errDotStart: 141,
    errDotEnd: 142,
    errDomainHyphenStart: 143,
    errDomainHyphenEnd: 144,
    errUnclosedQuotedString: 145,
    errUnclosedComment: 146,
    errUnclosedDomainLiteral: 147,
    errFWSCRLFx2: 148,
    errFWSCRLFEnd: 149,
    errCRNoLF: 150,
    errUnknownTLD: 160,
    errDomainTooShort: 161,
    errDotAfterDomainLiteral: 162,
    errMalformedUnicode: 163
};

export type DiagnosisName = $Keys<typeof diagnoses>;

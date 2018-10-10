'use strict';

// Load modules

const Punycode = require('punycode/'); // Load the userland punycode module over the core Node module.

const Constants = require('./constants');
const Reader = require('./reader');

// Declare internals

const internals = {
    maxIPv6Groups: 8
};


internals.specials = function () {

    const specials = '()<>[]:;@\\,."';        // US-ASCII visible characters not valid for atext (http://tools.ietf.org/html/rfc5322#section-3.2.3)
    const lookup = new Array(0x100);
    lookup.fill(false);

    for (let i = 0; i < specials.length; ++i) {
        lookup[specials.codePointAt(i)] = true;
    }

    return function (code) {

        return lookup[code];
    };
}();

internals.c0Controls = function () {

    const lookup = new Array(0x100);
    lookup.fill(false);

    // add C0 control characters

    for (let i = 0; i < 33; ++i) {
        lookup[i] = true;
    }

    return function (code) {

        return lookup[code];
    };
}();

internals.c1Controls = function () {

    const lookup = new Array(0x100);
    lookup.fill(false);

    // add C1 control characters

    for (let i = 127; i < 160; ++i) {
        lookup[i] = true;
    }

    return function (code) {

        return lookup[code];
    };
}();

internals.regex = {
    ipV4: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/,
    ipV6: /^[a-fA-F\d]{0,4}$/
};

internals.checkIpV6 = function (items) {

    return items.every((value) => internals.regex.ipV6.test(value));
};


class Parser {
    /**
     * @param {string} email The email address to parse.
     * @param {Diagnoses} diagnoses The Diagnoses object to which the parser
     *   will report problems with the email address.
     */
    constructor(email, diagnoses, { normalizeUnnecessaryQuoted = false } = {}) {

        this._reader = new Reader(email);
        this._diagnoses = diagnoses;

        this._normalizeUnnecessaryQuoted = normalizeUnnecessaryQuoted;
    }

    /**
     */
    diagnose(type, index = this._reader.prevIndex) {

        this._diagnoses.diagnose(type, index);
    }

    /**
     * Consume folding white space.
     *
     * http://tools.ietf.org/html/rfc5322#section-3.2.2
     *   FWS     =   ([*WSP CRLF] 1*WSP) /  obs-FWS
     *                                   ; Folding white space
     * But note the erratum:
     * http://www.rfc-editor.org/errata_search.php?rfc=5322&eid=1908:
     *   In the obsolete syntax, any amount of folding white space MAY be
     *   inserted where the obs-FWS rule is allowed.  This creates the
     *   possibility of having two consecutive "folds" in a line, and
     *   therefore the possibility that a line which makes up a folded header
     *   field could be composed entirely of white space.
     *   obs-FWS =   1*([CRLF] WSP)
     */
    parseFWS(prevRune) {

        let crlfCount = 0;

        for (;;) {
            const rune = this._reader.peek();

            if (!rune) {
                break;
            }

            if (prevRune === '\r') {
                if (rune === '\r') {
                    // Fatal error
                    // TODO: Doesn't this overlap with errCRNoLF?
                    this.diagnose(Constants.diagnoses.errFWSCRLFx2);
                    // We don't need to update prevRune here because it's already '\r'
                    this._reader.next();
                    continue;
                }

                if (++crlfCount > 1) {
                    // Multiple folds => obsolete FWS
                    this.diagnose(Constants.diagnoses.deprecatedFWS);
                }
                else {
                    crlfCount = 1;
                }
            }

            switch (rune) {
                case '\r':
                    // Consume the rune
                    this._reader.next();

                    const nextRune = this._reader.peek();

                    if (nextRune === '\n') {
                        this._reader.next();
                    }
                    else {
                        // Fatal error
                        this.diagnose(Constants.diagnoses.errCRNoLF);
                        // "Recover" from this fatal error by not consuming the next rune
                    }

                    break;

                case ' ':
                case '\t':
                    // Consume the rune
                    this._reader.next();
                    break;

                default:
                    // TODO: Consolidate with the post-loop error?
                    if (prevRune === '\r') {
                        // Fatal error
                        // TODO: Halt on fatal errors?
                        this.diagnose(Constants.diagnoses.errFWSCRLFEnd);
                    }

                    // http://tools.ietf.org/html/rfc5322#section-3.4.1
                    //   comments and folding white space SHOULD NOT be used around "@" in the addr-spec
                    //
                    // http://tools.ietf.org/html/rfc2119
                    // 4. SHOULD NOT this phrase, or the phrase "NOT RECOMMENDED" mean that there may exist valid reasons in particular
                    //    circumstances when the particular behavior is acceptable or even useful, but the full implications should be understood
                    //    and the case carefully weighed before implementing any behavior described with this label.
                    // TODO: This needs to only apply when immediately inside parseLocal - not inside parseQuotedString
                    /*if (this._reader.peek() === '@') {
                        this.diagnose(Constants.diagnoses.deprecatedCFWSNearAt, this._reader.index);
                    }*/

                    // End of FWS
                    return;
            }

            prevRune = rune;
        }

        // TODO: What's the right diagnosis here? Maybe we can just end with FWS
        // and be happy
        // this.diagnose(Constants.diagnoses.);
        if (prevRune === '\r') {
            // Is this right?
            this.diagnose(Constants.diagnoses.errFWSCRLFEnd);
        }
    }

    /**
     * Parse the given quoted pair.
     *
     * http://tools.ietf.org/html/rfc5322#section-3.2.1
     *   quoted-pair     =   ("\" (VCHAR / WSP)) / obs-qp
     *
     *   VCHAR           =  %d33-126   ; visible (printing) characters
     *   WSP             =  SP / HTAB  ; white space
     *
     *   obs-qp          =   "\" (%d0 / obs-NO-WS-CTL / LF / CR)
     *
     *   obs-NO-WS-CTL   =   %d1-8 /   ; US-ASCII control
     *                       %d11 /    ;  characters that do not
     *                       %d12 /    ;  include the carriage
     *                       %d14-31 / ;  return, line feed, and
     *                       %d127     ;  white space characters
     *
     * i.e. obs-qp       =  "\" (%d0-8, %d10-31 / %d127)
     *
     * @return {?string} The quoted rune.
     */
    parseQuotedPair() {

        const rune = this._reader.next().value;

        if (!rune) {
            this.diagnose(Constants.diagnoses.errBackslashEnd);
            return null;
        }

        const code = rune.codePointAt(0);

        if (code !== 127 && internals.c1Controls(code)) {
            this.diagnose(Constants.diagnoses.errExpectingQPair);
        }
        else if ((code < 31 && code !== 9) || code === 127) {
            // ' ' and '\t' are allowed
            this.diagnose(Constants.diagnoses.deprecatedQP);
        }

        return rune;
    }

    /**
     * Parse a quoted string, and return its content.
     *
     * http://tools.ietf.org/html/rfc5322#section-3.2.4
     *   quoted-string = [CFWS]
     *                   DQUOTE *([FWS] qcontent) [FWS] DQUOTE
     *                   [CFWS]
     *   qcontent      = qtext / quoted-pair
     *
     * @return {string} The contents of the quoted string.
     */
    parseQuotedString() {

        // TODO: Use some kind of stringbuilder? Can we just slice the original
        // string instead?
        let string = '';
        let needBeQuoted = false;
        for (const rune of this._reader) {
            switch (rune) {
                case '\\':
                    // Quoted pair
                    const quotedRune = this.parseQuotedPair();
                    string += `\\${quotedRune}`;
                    needBeQuoted = true;
                    // TODO: Do we need to track the element size?
                    break;

                case '\r':
                    // Folding white space. Spaces are allowed as regular characters inside a quoted string - it's only FWS if we include '\t' or '\r\n'

                    // TODO: Consolidate reading the CRLF and handling its error
                    const nextRune = this._reader.peek();

                    if (nextRune === '\n') {
                        this._reader.next();
                    }
                    else {
                        // Fatal error
                        this.diagnose(Constants.diagnoses.errCRNoLF);
                        // "Recover" from this fatal error by not consuming the next rune
                    }

                    // Fallthrough

                case '\t':
                    // http://tools.ietf.org/html/rfc5322#section-3.2.2
                    //   Runs of FWS, comment, or CFWS that occur between lexical tokens in
                    //   a structured header field are semantically interpreted as a single
                    //   space character.

                    // http://tools.ietf.org/html/rfc5322#section-3.2.4
                    //   the CRLF in any FWS/CFWS that appears within the quoted-string [is]
                    //   semantically "invisible" and therefore not part of the
                    //   quoted-string

                    string += ' ';

                    this.diagnose(Constants.diagnoses.cfwsFWS);
                    this.parseFWS(rune);
                    // TODO: What's the impact of not doing this? Seems more conservative to do this
                    needBeQuoted = true;
                    break;

                case '"':
                    // End of quoted string
                    if (needBeQuoted || !this._normalizeUnnecessaryQuoted) {
                        return `"${string}"`;
                    }

                    return string;

                default:
                    // QTEXT
                    // http://tools.ietf.org/html/rfc5322#section-3.2.4
                    //   qtext          =   %d33 /             ; Printable US-ASCII
                    //                      %d35-91 /          ;  characters not including
                    //                      %d93-126 /         ;  "\" or the quote character
                    //                      obs-qtext
                    //
                    //   obs-qtext      =   obs-NO-WS-CTL
                    //
                    //   obs-NO-WS-CTL  =   %d1-8 /            ; US-ASCII control
                    //                      %d11 /             ;  characters that do not
                    //                      %d12 /             ;  include the carriage
                    //                      %d14-31 /          ;  return, line feed, and
                    //                      %d127              ;  white space characters
                    const code = rune.codePointAt(0);

                    if ((code !== 127 && internals.c1Controls(code)) || code === 0 || code === 10) {
                        this.diagnose(Constants.diagnoses.errExpectingQTEXT);
                    }
                    else if (internals.c0Controls(code) || code === 127) {
                        this.diagnose(Constants.diagnoses.deprecatedQTEXT);
                    }

                    string += rune;

                // http://tools.ietf.org/html/rfc5322#section-3.4.1
                //   If the string can be represented as a dot-atom (that is, it contains
                //   no characters other than atext characters or "." surrounded by atext
                //   characters), then the dot-atom form SHOULD be used and the quoted-
                //   string form SHOULD NOT be used.

                // TODO: Should we do something about ^ for e.g. normalization
            }
        }

        this.diagnose(Constants.diagnoses.errUnclosedQuotedString);
        return string;
    }

    /**
     * Consume the given comment.
     *
     * We currently don't expose the contents of the comment in any way, as there
     * isn't a clear use-case for these comments.
     *
     * http://tools.ietf.org/html/rfc5322#section-3.2.2
     *   comment  = "(" *([FWS] ccontent) [FWS] ")"
     *   ccontent = ctext / quoted-pair / comment
     */
    parseComment() {

        for (const rune of this._reader) {
            switch (rune) {
                case '(':
                    // Nested comment - nested comments are ok
                    this.parseComment();
                    break;

                case ')':
                    // End of comment
                    // TODO: Return something usable?
                    return;

                case '\\':
                    // Quoted pair
                    this.parseQuotedPair();
                    break;

                case '\r':
                    // Folding white space
                    const nextRune = this._reader.peek();

                    if (nextRune === '\n') {
                        this._reader.next();
                    }
                    else {
                        // Fatal error
                        this.diagnose(Constants.diagnoses.errCRNoLF);
                        // "Recover" from this fatal error by not consuming the next rune
                    }

                    // Fallthrough

                case ' ':
                case '\t':
                    this.diagnose(Constants.diagnoses.cfwsFWS);

                    this.parseFWS(rune);
                    break;

                default:
                    // CTEXT
                    // http://tools.ietf.org/html/rfc5322#section-3.2.3
                    //   ctext         = %d33-39 /  ; Printable US-ASCII
                    //                   %d42-91 /  ;  characters not including
                    //                   %d93-126 / ;  "(", ")", or "\"
                    //                   obs-ctext
                    //
                    //   obs-ctext     = obs-NO-WS-CTL
                    //
                    //   obs-NO-WS-CTL = %d1-8 /    ; US-ASCII control
                    //                   %d11 /     ;  characters that do not
                    //                   %d12 /     ;  include the carriage
                    //                   %d14-31 /  ;  return, line feed, and
                    //                   %d127      ;  white space characters

                    const code = rune.codePointAt(0);

                    if (code === 0 || code === 10 || (code !== 127 && internals.c1Controls(code))) {
                        // Fatal error
                        this.diagnose(Constants.diagnoses.errExpectingCTEXT);
                        break;
                    }
                    else if (internals.c0Controls(code) || code === 127) {
                        this.diagnose(Constants.diagnoses.deprecatedCTEXT);
                    }
            }
        }

        // If we get here, then we didn't encounter an end to the comment
        this.diagnose(Constants.diagnoses.errUnclosedComment);
    }

    /**
     * Parse the local-part of the email address.
     *
     * http://tools.ietf.org/html/rfc5322#section-3.4.1
     *   local-part      =   dot-atom / quoted-string / obs-local-part
     *   dot-atom        =   [CFWS] dot-atom-text [CFWS]
     *   dot-atom-text   =   1*atext *("." 1*atext)
     *   quoted-string   =   [CFWS]
     *                     DQUOTE *([FWS] qcontent) [FWS] DQUOTE
     *                     [CFWS]
     *   obs-local-part  =   word *("." word)
     *   word            =   atom / quoted-string
     *   atom            =   [CFWS] 1*atext [CFWS]
     *
     * @return {string}
     */
    parseLocal() {

        let localLength = 0;
        const elements = [];
        let element = '';
        let assertEnd = null;
        let wasCFWS = false;

        for (const rune of this._reader) {
            switch (rune) {
                case '(':
                    // Comment
                    if (!element) {
                        // Comments are OK at the beginning of an element
                        // TODO: The above comment is misleading; why are comments after the first element deprecated?
                        this.diagnose(elements.length === 0 ? Constants.diagnoses.cfwsComment : Constants.diagnoses.deprecatedComment);
                    }
                    else {
                        this.diagnose(Constants.diagnoses.cfwsComment);
                        // Cannot start a comment in an element, should be end
                        assertEnd = 'cfws';
                    }

                    this.parseComment();
                    wasCFWS = true;
                    // TODO: Check for fatal?
                    break;

                case '.':
                    // Next dot-atom element
                    if (!element) {
                        // Another dot, already?
                        this.diagnose(elements.length === 0 ? Constants.diagnoses.errDotStart : Constants.diagnoses.errConsecutiveDots);
                    }
                    else {
                        // The entire local-part can be a quoted string for RFC 5321; if one atom is quoted it's an RFC 5322 obsolete form
                        // TODO: Does this unintentionally apply to FWS and comments? Or maybe it's intentional/a no-op due to worstDiagnosis
                        if (assertEnd) {
                            this.diagnose(Constants.diagnoses.deprecatedLocalPart);
                        }

                        // CFWS & quoted strings are OK again now we're at the beginning of an element (although they are obsolete forms)
                        assertEnd = null;
                        elements.push(element);
                        element = '';
                        ++localLength;
                    }

                    wasCFWS = false;

                    break;

                case '"':
                    // Quoted string
                    if (!element) {
                        // The entire local-part can be a quoted string for RFC 5321; if one atom is quoted it's an RFC 5322 obsolete form
                        this.diagnose(elements.length === 0 ? Constants.diagnoses.rfc5321QuotedString : Constants.diagnoses.deprecatedLocalPart);

                        // Quoted string must be the entire element
                        assertEnd = 'quoted';
                        const quotedString = this.parseQuotedString();
                        localLength += Buffer.byteLength(quotedString, 'utf8') + (quotedString[0] !== '"') * 2;
                        // TODO: Can we instead add this to elements directly?
                        element += quotedString;
                    }
                    else {
                        this.diagnose(Constants.diagnoses.errExpectingATEXT);
                    }

                    wasCFWS = false;

                    break;

                case '\r':
                    // Folding white space
                    const nextRune = this._reader.peek();

                    if (nextRune === '\n') {
                        this._reader.next();
                    }
                    else {
                        // Fatal error
                        this.diagnose(Constants.diagnoses.errCRNoLF);
                        // "Recover" from this fatal error by not consuming the next rune
                    }

                    // Fallthrough

                case ' ':
                case '\t':
                    if (!element) {
                        this.diagnose(elements.length === 0 ? Constants.diagnoses.cfwsFWS : Constants.diagnoses.deprecatedFWS);
                    }
                    else {
                        // We can't start FWS in the middle of an element, better be end
                        assertEnd = 'cfws';
                    }

                    this.parseFWS(rune);
                    wasCFWS = true;

                    break;

                case '@':
                    // TODO: Combine with post-loop logic?
                    if (element) {
                        elements.push(element);
                    }

                    // At this point we should have a valid local-part
                    if (!elements.length) {
                        // Fatal error
                        this.diagnose(Constants.diagnoses.errNoLocalPart);
                    }
                    else {
                        if (!element) {
                            this.diagnose(Constants.diagnoses.errDotEnd);
                        }

                        // http://tools.ietf.org/html/rfc5321#section-4.5.3.1.1
                        //   the maximum total length of a user name or other local-part is 64 octets
                        if (localLength > 64) {
                            this.diagnose(Constants.diagnoses.rfc5322LocalTooLong);
                        }
                    }

                    // http://tools.ietf.org/html/rfc5322#section-3.4.1
                    //   comments and folding white space SHOULD NOT be used around "@" in the addr-spec
                    //
                    // http://tools.ietf.org/html/rfc2119
                    // 4. SHOULD NOT this phrase, or the phrase "NOT RECOMMENDED" mean that there may exist valid reasons in particular
                    //    circumstances when the particular behavior is acceptable or even useful, but the full implications should be understood
                    //    and the case carefully weighed before implementing any behavior described with this label.
                    if (wasCFWS) {
                        this.diagnose(Constants.diagnoses.deprecatedCFWSNearAt);
                    }

                    // TODO: Combine with post-loop logic?
                    return elements;

                default:
                    // ATEXT
                    // http://tools.ietf.org/html/rfc5322#section-3.2.3
                    //    atext = ALPHA / DIGIT / ; Printable US-ASCII
                    //            "!" / "#" /     ;  characters not including
                    //            "$" / "%" /     ;  specials.  Used for atoms.
                    //            "&" / "'" /
                    //            "*" / "+" /
                    //            "-" / "/" /
                    //            "=" / "?" /
                    //            "^" / "_" /
                    //            "`" / "{" /
                    //            "|" / "}" /
                    //            "~"
                    if (assertEnd) {
                        switch (assertEnd) {
                            case 'cfws':
                                this.diagnose(Constants.diagnoses.errATEXTAfterCFWS);
                                break;

                            default:
                                this.diagnose(Constants.diagnoses.errATEXTAfterQS);
                        }
                    }
                    else {
                        const code = rune.codePointAt(0);

                        // Especially if code == 10
                        if (internals.specials(code) || internals.c0Controls(code) || internals.c1Controls(code)) {

                            // Fatal error
                            this.diagnose(Constants.diagnoses.errExpectingATEXT);
                        }

                        element += rune;
                        localLength += Buffer.byteLength(rune, 'utf8');
                    }

                    wasCFWS = false;
            }
        }

        this.diagnose(Constants.diagnoses.errNoDomain);

        if (element) {
            elements.push(element);
        }

        return elements;
    }

    /**
     * Parse the domain literal of the email address.
     */
    parseDomainLiteral() {

        let literal = '';

        for (const rune of this._reader) {
            switch (rune) {
                case ']':
                    // End of domain literal

                    // TODO: what about if there are configured exclusions?
                    const worstDiagnosis = this._diagnoses.getWorstDiagnosis();

                    if (worstDiagnosis && worstDiagnosis.type >= Constants.categories.deprecated) {
                        // TODO: Is this "optimization" worthwhile when we want to report all the diagnoses?
                        // TODO: Should we have something generic that tells us whether to check a branch depending on whether we're in a report-all mode?
                        this.diagnose(Constants.diagnoses.rfc5322DomainLiteral);
                    }
                    else {
                        // http://tools.ietf.org/html/rfc5321#section-4.1.2
                        //   address-literal  = "[" ( IPv4-address-literal /
                        //                    IPv6-address-literal /
                        //                    General-address-literal ) "]"
                        //                    ; See Section 4.1.3
                        //
                        // http://tools.ietf.org/html/rfc5321#section-4.1.3
                        //   IPv4-address-literal  = Snum 3("."  Snum)
                        //
                        //   IPv6-address-literal  = "IPv6:" IPv6-addr
                        //
                        //   General-address-literal  = Standardized-tag ":" 1*dcontent
                        //
                        //   Standardized-tag  = Ldh-str
                        //                     ; Standardized-tag MUST be specified in a
                        //                     ; Standards-Track RFC and registered with IANA
                        //
                        //   dcontent      = %d33-90 / ; Printable US-ASCII
                        //                 %d94-126 ; excl. "[", "\", "]"
                        //
                        //   Snum          = 1*3DIGIT
                        //                 ; representing a decimal integer
                        //                 ; value in the range 0 through 255
                        //
                        //   IPv6-addr     = IPv6-full / IPv6-comp / IPv6v4-full / IPv6v4-comp
                        //
                        //   IPv6-hex      = 1*4HEXDIG
                        //
                        //   IPv6-full     = IPv6-hex 7(":" IPv6-hex)
                        //
                        //   IPv6-comp     = [IPv6-hex *5(":" IPv6-hex)] "::"
                        //                 [IPv6-hex *5(":" IPv6-hex)]
                        //                 ; The "::" represents at least 2 16-bit groups of
                        //                 ; zeros.  No more than 6 groups in addition to the
                        //                 ; "::" may be present.
                        //
                        //   IPv6v4-full   = IPv6-hex 5(":" IPv6-hex) ":" IPv4-address-literal
                        //
                        //   IPv6v4-comp   = [IPv6-hex *3(":" IPv6-hex)] "::"
                        //                 [IPv6-hex *3(":" IPv6-hex) ":"]
                        //                 IPv4-address-literal
                        //                 ; The "::" represents at least 2 16-bit groups of
                        //                 ; zeros.  No more than 4 groups in addition to the
                        //                 ; "::" and IPv4-address-literal may be present.

                        const matchesIP = internals.regex.ipV4.exec(literal);
                        let index = -1;
                        let addressLiteral = literal;

                        // Maybe extract the IPv4 part from the end of the address-literal
                        if (matchesIP) {
                            index = matchesIP.index;
                            if (index !== 0) {
                                // Convert IPv4 part to IPv6 format for further testing
                                addressLiteral = addressLiteral.slice(0, index) + '0:0';
                            }
                        }

                        if (index === 0) {
                            // We only see a valid IPv4 address, so we're done here
                            this.diagnose(Constants.diagnoses.rfc5321AddressLiteral);
                        }
                        else if (!addressLiteral.toLowerCase().startsWith('ipv6:')) {
                            this.diagnose(Constants.diagnoses.rfc5322DomainLiteral);
                        }
                        else {
                            const match = addressLiteral.slice(5);
                            const groups = match.split(':');
                            let maxGroups = internals.maxIPv6Groups;
                            index = match.indexOf('::');

                            // TODO: make this condition comprehensible
                            if (!~index) {
                                // Need exactly the right number of groups
                                if (groups.length !== maxGroups) {
                                    // TODO: Fix the indices for these diagnoses
                                    this.diagnose(Constants.diagnoses.rfc5322IPv6GroupCount);
                                }
                            }
                            else if (match.indexOf('::', index + 1) > 0) {
                                this.diagnose(Constants.diagnoses.rfc5322IPv62x2xColon);
                            }
                            else {
                                if (index === 0 || index === match.length - 2) {
                                    // RFC 4291 allows :: at the start or end of an address with 7 other groups in addition
                                    ++maxGroups;
                                }

                                if (groups.length > maxGroups) {
                                    this.diagnose(Constants.diagnoses.rfc5322IPv6MaxGroups);
                                }
                                else if (groups.length === maxGroups) {
                                    // Eliding a single "::"
                                    this.diagnose(Constants.diagnoses.deprecatedIPv6);
                                }
                            }

                            // IPv6 testing strategy
                            if (match[0] === ':' && match[1] !== ':') {
                                this.diagnose(Constants.diagnoses.rfc5322IPv6ColonStart);
                            }
                            else if (match[match.length - 1] === ':' && match[match.length - 2] !== ':') {
                                this.diagnose(Constants.diagnoses.rfc5322IPv6ColonEnd);
                            }
                            else if (internals.checkIpV6(groups)) {
                                this.diagnose(Constants.diagnoses.rfc5321AddressLiteral);
                            }
                            else {
                                this.diagnose(Constants.diagnoses.rfc5322IPv6BadCharacter);
                            }
                        }
                    }

                    return `${literal}]`;

                case '\\':
                    this.diagnose(Constants.diagnoses.rfc5322DomainLiteralOBSDText);
                    this.parseQuotedPair();
                    break;

                case '\r':
                    // Folding white space
                    const nextRune = this._reader.peek();

                    if (nextRune === '\n') {
                        this._reader.next();
                    }
                    else {
                        // Fatal error
                        this.diagnose(Constants.diagnoses.errCRNoLF);
                        // "Recover" from this fatal error by not consuming the next rune
                    }

                    // Fallthrough

                case ' ':
                case '\t':
                    this.diagnose(Constants.diagnoses.cfwsFWS);

                    this.parseFWS(rune);
                    break;

                default:
                    // DTEXT
                    // http://tools.ietf.org/html/rfc5322#section-3.4.1
                    //   dtext         =   %d33-90 /  ; Printable US-ASCII
                    //                     %d94-126 / ;  characters not including
                    //                     obs-dtext  ;  "[", "]", or "\"
                    //
                    //   obs-dtext     =   obs-NO-WS-CTL / quoted-pair
                    //
                    //   obs-NO-WS-CTL =   %d1-8 /    ; US-ASCII control
                    //                     %d11 /     ;  characters that do not
                    //                     %d12 /     ;  include the carriage
                    //                     %d14-31 /  ;  return, line feed, and
                    //                     %d127      ;  white space characters
                    const code = rune.codePointAt(0);

                    // '\r', '\n', ' ', and '\t' have already been parsed above
                    if ((code !== 127 && internals.c1Controls(code)) || code === 0 || rune === '[') {
                        // Fatal error
                        this.diagnose(Constants.diagnoses.errExpectingDTEXT);
                        break;
                    }
                    else if (internals.c0Controls(code) || code === 127) {
                        this.diagnose(Constants.diagnoses.rfc5322DomainLiteralOBSDText);
                    }

                    literal += rune;
            }
        }

        // TODO: are there other diagnoses to consider here?

        this.diagnose(Constants.diagnoses.errUnclosedDomainLiteral);
        return literal;
    }

    /**
     * Parse the domain of the email address.
     *
     * http://tools.ietf.org/html/rfc5322#section-3.4.1
     *   domain          =   dot-atom / domain-literal / obs-domain
     *   dot-atom        =   [CFWS] dot-atom-text [CFWS]
     *   dot-atom-text   =   1*atext *("." 1*atext)
     *   domain-literal  =   [CFWS] "[" *([FWS] dtext) [FWS] "]" [CFWS]
     *   dtext           =   %d33-90 /          ; Printable US-ASCII
     *                       %d94-126 /         ;  characters not including
     *                       obs-dtext          ;  "[", "]", or "\"
     *   obs-domain      =   atom *("." atom)
     *   atom            =   [CFWS] 1*atext [CFWS]
     *
     * http://tools.ietf.org/html/rfc5321#section-4.1.2
     *   Mailbox        = Local-part "@" ( Domain / address-literal )
     *   Domain         = sub-domain *("." sub-domain)
     *   address-literal  = "[" ( IPv4-address-literal /
     *                    IPv6-address-literal /
     *                    General-address-literal ) "]"
     *                    ; See Section 4.1.3
     *
     * http://tools.ietf.org/html/rfc5322#section-3.4.1
     *      Note: A liberal syntax for the domain portion of addr-spec is
     *      given here.  However, the domain portion contains addressing
     *      information specified by and used in other protocols (e.g.,
     *      [RFC1034], [RFC1035], [RFC1123], [RFC5321]).  It is therefore
     *      incumbent upon implementations to conform to the syntax of
     *      addresses for the context in which they are used.
     *
     * is_email() author's note: it's not clear how to interpret this in
     * the context of a general email address validator. The conclusion I
     * have reached is this: "addressing information" must comply with
     * RFC 5321 (and in turn RFC 1035), anything that is "semantically
     * invisible" must comply only with RFC 5322.
     */
    parseDomain() {

        const elements = [];
        let element = '';
        let assertEnd = null;

        for (const rune of this._reader) {
            switch (rune) {
                case '(':
                    // Comment
                    if (!element) {
                        // Comments at the start of the domain are deprecated in the text, comments at the start of a subdomain are obs-domain
                        // http://tools.ietf.org/html/rfc5322#section-3.4.1
                        this.diagnose(elements.length === 0 ? Constants.diagnoses.deprecatedCFWSNearAt : Constants.diagnoses.deprecatedComment);
                    }
                    else {
                        this.diagnose(Constants.diagnoses.cfwsComment);

                        // We can't start a comment mid-element, better be at the end
                        assertEnd = 'cfws';
                    }

                    this.parseComment();
                    break;

                case '.':
                    if (assertEnd === 'literal') {
                        // TODO: This isn't quite the right diagnosis
                        this.diagnose(Constants.diagnoses.errDotAfterDomainLiteral);
                    }

                    // Next dot-atom element
                    if (!element) {
                        // Another dot, already? Fatal error.
                        this.diagnose(elements.length === 0 ? Constants.diagnoses.errDotStart : Constants.diagnoses.errConsecutiveDots);
                    }
                    else if (element[element.length - 1] === '-') {
                        // Previous subdomain ended in a hyphen. Fatal error.
                        this.diagnose(Constants.diagnoses.errDomainHyphenEnd, this._reader.prevIndex - 1);
                    }
                    else if (Punycode.toASCII(element).length > 63) {
                        // RFC 5890 specifies that domain labels that are encoded using the Punycode algorithm
                        // must adhere to the <= 63 octet requirement.
                        // This includes string prefixes from the Punycode algorithm.
                        //
                        // https://tools.ietf.org/html/rfc5890#section-2.3.2.1
                        // labels          63 octets or less

                        this.diagnose(Constants.diagnoses.rfc5322LabelTooLong);
                    }

                    // CFWS is OK again now we're at the beginning of an element (although
                    // it may be obsolete CFWS)
                    assertEnd = null;

                    elements.push(element);
                    element = '';

                    break;

                case '[':
                    // Domain literal
                    // TODO: can we add a flag that returns the remainder once
                    // we fail the configured validity? That way we could
                    // support me@[127.0.0.1].no which would produce ".no" as
                    // the remainder.

                    if (element) {
                        elements.push(element);
                        element = '';
                    }

                    if (elements.length) {
                        this.diagnose(Constants.diagnoses.errExpectingATEXT);
                    }
                    else {
                        // Domain literal must be the only component
                        assertEnd = 'literal';
                        // TODO: what happens after this runs?
                        element += rune + this.parseDomainLiteral();
                    }

                    break;

                case '\r':
                    // Folding white space
                    const nextRune = this._reader.peek();

                    if (nextRune === '\n') {
                        this._reader.next();
                    }
                    else {
                        // Fatal error
                        this.diagnose(Constants.diagnoses.errCRNoLF);
                        // "Recover" from this fatal error by not consuming the next rune
                    }

                    // Fallthrough

                case ' ':
                case '\t':
                    if (!element) {
                        this.diagnose(elements.length === 0 ? Constants.diagnoses.deprecatedCFWSNearAt : Constants.diagnoses.deprecatedFWS);
                    }
                    else {
                        // We can't start FWS in the middle of an element, so this better be the end
                        this.diagnose(Constants.diagnoses.cfwsFWS);
                        assertEnd = 'cfws';
                    }

                    this.parseFWS(rune);
                    break;

                default:
                    // ATEXT
                    // RFC 5322 allows any atext...
                    // http://tools.ietf.org/html/rfc5322#section-3.2.3
                    //    atext = ALPHA / DIGIT / ; Printable US-ASCII
                    //            "!" / "#" /     ;  characters not including
                    //            "$" / "%" /     ;  specials.  Used for atoms.
                    //            "&" / "'" /
                    //            "*" / "+" /
                    //            "-" / "/" /
                    //            "=" / "?" /
                    //            "^" / "_" /
                    //            "`" / "{" /
                    //            "|" / "}" /
                    //            "~"

                    // But RFC 5321 only allows letter-digit-hyphen to comply with DNS rules
                    //   (RFCs 1034 & 1123)
                    // http://tools.ietf.org/html/rfc5321#section-4.1.2
                    //   sub-domain     = Let-dig [Ldh-str]
                    //   Let-dig        = ALPHA / DIGIT
                    //   Ldh-str        = *( ALPHA / DIGIT / "-" ) Let-dig

                    if (assertEnd) {
                        // We have encountered ATEXT where it is not valid
                        switch (assertEnd) {
                            case 'cfws':
                                this.diagnose(Constants.diagnoses.errATEXTAfterCFWS);
                                break;

                            default:
                                this.diagnose(Constants.diagnoses.errATEXTAfterDomainLiteral);
                        }
                    }

                    const code = rune.codePointAt(0);

                    if (internals.specials(code) || internals.c0Controls(code) || internals.c1Controls(code)) {
                        // Fatal error
                        this.diagnose(Constants.diagnoses.errExpectingATEXT);
                    }
                    else if (rune === '-') {
                        if (!element) {
                            this.diagnose(Constants.diagnoses.errDomainHyphenStart);
                        }
                    }
                    // TODO: Where did 192 come from?
                    else if (code < 48 || (code > 122 && code < 192) || (code > 57 && code < 65) || (code > 90 && code < 97)) {
                        // Check if it's a neither a number nor a latin/unicode letter
                        this.diagnose(Constants.diagnoses.rfc5322Domain);
                    }

                    element += rune;
            }
        }

        if (element) {
            elements.push(element);
        }

        if (!elements.length) {
            this.diagnose(Constants.diagnoses.errNoDomain);
        }
        else if (!element) {
            this.diagnose(Constants.diagnoses.errDotEnd);
        }
        else {
            if (element[element.length - 1] === '-') {
                // TODO: Fix the index on this
                this.diagnose(Constants.diagnoses.errDomainHyphenEnd);
            }

            // Per RFC 5321, domain atoms are limited to letter-digit-hyphen, so we only need to check code <= 57 to check for a digit.
            // This also works with i18n domains.
            if (element.codePointAt(0) <= 57) {
                this.diagnose(Constants.diagnoses.rfc5321TLDNumeric);
            }

            if (Punycode.toASCII(element).length > 63) {
                this.diagnose(Constants.diagnoses.rfc5322LabelTooLong);
            }

            if (Punycode.toASCII(elements.join('.')).length > 255) {
                // http://tools.ietf.org/html/rfc5321#section-4.5.3.1.2
                //   The maximum total length of a domain name or number is 255 octets.
                this.diagnose(Constants.diagnoses.rfc5322DomainTooLong);
            }
        }

        // TODO: Also validate minDomainAtoms, tldAllow/tldForbid

        return { elements, domain: elements.join('.') };
    }

    /**
     * Parse the entire email address.
     */
    parse() {

        const localParts = this.parseLocal();
        const local = localParts.join('.');

        // If there's no domain (i.e. there's no @-symbol) then there's no point
        // in considering the rest. TODO: Maybe have parseLocal pushback the @?
        if (this._diagnoses.hasDiagnosis(Constants.diagnoses.errNoDomain)) {
            return null;
        }

        const { elements: domainParts, domain } = this.parseDomain();

        const normalizedEmail = `${local}@${Punycode.toASCII(domain)}`;

        // TODO: Should we normalize the domain one way or another?
        const domainLength = /^[\x00-\x7f]+$/.test(domain) ? domain.length : Punycode.toASCII(domain).length;
        const emailLength = Buffer.byteLength(local, 'utf8') + domainLength + 1;
        // TODO: Add test for CFWS not impacting this?
        if (emailLength > 254) {
            // http://tools.ietf.org/html/rfc5321#section-4.1.2
            //   Forward-path   = Path
            //
            //   Path           = "<" [ A-d-l ":" ] Mailbox ">"
            //
            // http://tools.ietf.org/html/rfc5321#section-4.5.3.1.3
            //   The maximum total length of a reverse-path or forward-path is 256 octets (including the punctuation and element separators).
            //
            // Thus, even without (obsolete) routing information, the Mailbox can only be 254 characters long. This is confirmed by this verified
            // erratum to RFC 3696:
            //
            // http://www.rfc-editor.org/errata_search.php?rfc=3696&eid=1690
            //   However, there is a restriction in RFC 2821 on the length of an address in MAIL and RCPT commands of 254 characters.  Since
            //   addresses that do not fit in those fields are not normally useful, the upper limit on address lengths should normally be considered
            //   to be 254.
            this.diagnose(Constants.diagnoses.rfc5322TooLong);
        }

        return {
            localParts,
            local,
            domainParts,
            domain,
            email: normalizedEmail
        };
    }
}

module.exports = Parser;

// Code shows a string is valid,
// but docs require string array or object.
type TLDList = string | string[] | { [topLevelDomain: string]: any }

type BaseOptions = {
	tldWhitelist?: TLDList
	tldBlacklist?: TLDList
	minDomainAtoms?: number
	allowUnicode?: boolean
}

type OptionsWithBool = BaseOptions & {
	errorLevel?: false
}

type OptionsWithNumThreshold = BaseOptions & {
	errorLevel?: true | number
}

interface Validator {
	/**
	 * Check that an email address conforms to RFCs 5321, 5322, 6530 and others.
	 *
	 * The callback function will always be called
	 * with the result of the operation.
	 *
	 * ```
	 * import * as IsEmail from "isemail";
	 *
	 * const log = result => console.log(`Result: ${result}`);
	 * IsEmail.validate("test@iana.org", log);
	 * // >_ Result: true
	 * // => true
	 *
	 * IsEmail.validate("test@e.com");
	 * // => true
	 * ```
	 */
	validate(email: string, callback?: (result: boolean) => void): boolean

	/**
	 * Check that an email address conforms to RFCs 5321, 5322, 6530 and others.
	 *
	 * The callback function will always be called
	 * with the result of the operation.
	 *
	 * ```
	 * import * as IsEmail from "isemail";
	 *
	 * const log = result => console.log(`Result: ${result}`);
	 * IsEmail.validate("test@iana.org", { errorLevel: false }, log);
	 * // >_ Result: true
	 * // => true
	 * ```
	 */
	validate(
		email: string,
		options: OptionsWithBool,
		callback?: (result: boolean) => void
	): boolean

	/**
	 * Check that an email address conforms to RFCs 5321, 5322, 6530 and others.
	 *
	 * The callback function will always be called
	 * with the result of the operation.
	 *
	 * ```
	 * import * as IsEmail from "isemail";
	 *
	 * const log = result => console.log(`Result: ${result}`);
	 * IsEmail.validate("test@iana.org", { errorLevel: true }, log);
	 * // >_ Result: 0
	 * // => 0
	 * IsEmail.validate("test @e.com", { errorLevel: 50 }, log);
	 * // >_ Result: 0
	 * // => 0
	 * IsEmail.validate('test @e.com', { errorLevel: true }, log)
	 * // >_ Result: 49
	 * // => 49
	 * ```
	 */
	validate(
		email: string,
		options: OptionsWithNumThreshold,
		callback?: (result: number | undefined) => void
	): number
}

declare const IsEmail: Validator

export = IsEmail

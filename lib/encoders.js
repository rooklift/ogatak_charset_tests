"use strict";

// Node has decoders (util.TextDecoder) for the legacy charsets but no encoders,
// so we build encoders by inverting each decoder's byte(s) --> char map. The
// multibyte tables are built by brute force, which takes a moment per charset,
// so encoders are cached and reused.

const util = require("util");

const SINGLE_BYTE = ["windows-1252", "windows-1251", "koi8-r"];
const MULTI_BYTE = ["shift_jis", "euc-jp", "euc-kr", "gbk", "big5"];

const cache = Object.create(null);

function make_single_byte_map(charset) {
	let dec = new util.TextDecoder(charset);
	let map = Object.create(null);
	for (let b = 0; b < 256; b++) {
		let ch = dec.decode(new Uint8Array([b]));
		if (ch !== "�") {
			map[ch] = [b];
		}
	}
	return map;
}

function make_multi_byte_map(charset) {
	let map = Object.create(null);
	for (let b = 0; b < 128; b++) {
		map[String.fromCharCode(b)] = [b];
	}
	for (let b1 = 0x81; b1 < 256; b1++) {
		for (let b2 = 0x40; b2 < 256; b2++) {
			let s = new util.TextDecoder(charset).decode(new Uint8Array([b1, b2]));
			if (s.length === 1 && s !== "�" && map[s] === undefined) {
				map[s] = [b1, b2];
			}
		}
	}
	return map;
}

exports.get_encoder = function(charset) {

	// Returns a function from string --> Uint8Array of the string encoded in
	// the given charset. Throws while encoding if some character can't be
	// represented in the charset.

	if (cache[charset] === undefined) {
		let map;
		if (SINGLE_BYTE.includes(charset)) {
			map = make_single_byte_map(charset);
		} else if (MULTI_BYTE.includes(charset)) {
			map = make_multi_byte_map(charset);
		} else {
			throw new Error(`No encoder available for ${charset}`);
		}
		cache[charset] = function(s) {
			let out = [];
			for (let ch of s) {
				if (map[ch] === undefined) {
					throw new Error(`Can't encode "${ch}" (U+${ch.codePointAt(0).toString(16)}) in ${charset}`);
				}
				out.push(...map[ch]);
			}
			return new Uint8Array(out);
		};
	}

	return cache[charset];
};

exports.SINGLE_BYTE = SINGLE_BYTE;
exports.MULTI_BYTE = MULTI_BYTE;

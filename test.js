"use strict";

// Tests ogatak's charset guesser against the corpus in files/ and against a
// generated sweep of windows-1252 characters.
//
// Run: node test.js [path/to/guess_charset.js]
//
// With no argument, expects an ogatak checkout as a sibling directory of this
// repo, i.e. the guesser is at ../ogatak/src/modules/guess_charset.js
//
// Part 1: every .sgf under files/<expected>/ must be guessed as <expected>,
// where the directory name "null" means the guesser must decline (return null).
// Files named ambiguous_* carry no expectation -- their content is inherently
// ambiguous (kanji-only bytes carry no Japanese-vs-Chinese signal, all-caps
// Cyrillic is valid in both Cyrillic charsets, etc) -- so the guesser's answer
// for them is simply reported, with their directory still recording the truth.
//
// Part 2: every windows-1252 character 0xA0-0xFF, in each of several contexts
// inside an otherwise-plain SGF file, must never be guessed as anything but
// windows-1252 (or null). SGF's default charset is Latin-1, so files like
// these are common and must survive guessing -- this is the "sensible Latin-1
// content is never interpreted as something else" guarantee.

const fs = require("fs");
const path = require("path");
const util = require("util");
const {get_encoder} = require("./lib/encoders");

// Ogatak lets the user switch off individual charsets, which guess_charset() reads from a
// config global that the app sets up at startup. For testing, enable every charset -- the
// Proxy answers true for any key, so charsets added in future are enabled here too.

global.config = new Proxy({}, {get: () => true});

const guess_charset = process.argv[2] ?
	require(path.resolve(process.cwd(), process.argv[2])) :
	require(path.join(__dirname, "../ogatak/src/modules/guess_charset"));

const LIMIT = 65536;			// Same as load_sgf's TEST_LIMIT.

const strict_utf8 = new util.TextDecoder("utf-8", {fatal: true});

function is_valid_utf8(buf) {
	try {
		strict_utf8.decode(buf);
		return true;
	} catch (err) {
		return false;
	}
}

let failures = 0;

// ------------------------------------------------------------------------------------------------
// Part 1: the file corpus.

console.log("file corpus:");

let files_dir = path.join(__dirname, "files");
let file_count = 0;
let ambiguous_report = [];

for (let directory of fs.readdirSync(files_dir).sort()) {

	let expected = (directory === "null") ? null : directory;
	let dirpath = path.join(files_dir, directory);

	for (let name of fs.readdirSync(dirpath).sort()) {

		let buf = fs.readFileSync(path.join(dirpath, name));
		let rel = `files/${directory}/${name}`;

		if (expected !== null && is_valid_utf8(buf)) {
			failures++;
			console.log(`    FAIL: ${rel} is valid UTF-8 and would never reach the guesser`);
			continue;
		}

		let got = guess_charset(buf, LIMIT);

		if (name.startsWith("ambiguous_")) {
			ambiguous_report.push(`    ${rel} -> ${got}`);
			continue;
		}

		file_count++;
		if (got !== expected) {
			failures++;
			console.log(`    FAIL: ${rel} -- want ${expected} got ${got}`);
		}
	}
}

console.log(`    (${file_count} files)`);

console.log("ambiguous files, no expectations, for interest the guesses are:");
for (let line of ambiguous_report) {
	console.log(line);
}

// ------------------------------------------------------------------------------------------------
// Part 2: the windows-1252 sweep.

console.log("windows-1252 sweep:");

const sweep_templates = [
	"(;GM[1]FF[4]PB[Xmile]PW[John];B[pd])",					// Word-initial, lowercase follows. (The hard case: X + m can form a CJK byte pair.)
	"(;GM[1]FF[4]PB[HervX]PW[John];B[pd])",					// Word-final, ] follows. (X + ] as a CJK pair would eat the closing bracket.)
	"(;GM[1]FF[4]PB[MXller]PW[John];B[pd])",				// Mid-word.
	"(;GM[1]FF[4]C[X la fin];B[pd])",						// Word-initial, space follows.
	"(;GM[1]FF[4]C[one X two];B[pd])",						// Isolated.
	"(;GM[1]FF[4]C[3X points de komi pour blanc];B[pd])",	// After a digit (e.g. 6½).
];

const enc1252 = get_encoder("windows-1252");
const dec1252 = new util.TextDecoder("windows-1252");

let sweep_count = 0;

for (let b = 0xa0; b < 256; b++) {
	let ch = dec1252.decode(new Uint8Array([b]));
	for (let t of sweep_templates) {
		let text = t.replace("X", ch);
		let got = guess_charset(enc1252(text), LIMIT);
		sweep_count++;
		if (got !== null && got !== "windows-1252") {
			failures++;
			console.log(`    FAIL: 0x${b.toString(16)} "${ch}" -> ${got} in ${text.slice(0, 40)}`);
		}
	}
}

console.log(`    (${sweep_count} cases)`);

// ------------------------------------------------------------------------------------------------

console.log(failures === 0 ? "\nAll tests passed." : `\n${failures} FAILURES.`);
process.exit(failures === 0 ? 0 : 1);

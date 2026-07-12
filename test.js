"use strict";

// Tests ogatak's charset guesser against the corpus in files/ and against a
// generated sweep of latin1 characters.
//
// Run: node test.js [path/to/guess_charset.js]
//
// With no argument, expects an ogatak checkout as a sibling directory of this
// repo, i.e. the guesser is at ../ogatak/src/modules/guess_charset.js
//
// Part 1: every .sgf under files/<expected>/ must be guessed as <expected>,
// where the directory name "null" means the guesser must decline (return null).
// Part 2: every latin1 character 0xA0-0xFF, in each of several contexts
// inside an otherwise-plain SGF file, must never be guessed as anything but
// latin1 (or null). SGF's default charset is Latin-1, so files like
// these are common and must survive guessing -- this is the "sensible Latin-1
// content is never interpreted as something else" guarantee.

const fs = require("fs");
const path = require("path");
const util = require("util");
const {get_encoder} = require("./lib/encoders");

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

let files_dir = path.join(__dirname, "files");
let file_count = 0;

let fails = Object.create(null);

for (let directory of fs.readdirSync(files_dir).sort()) {

	let expected = (directory === "null") ? null : directory;
	let dirpath = path.join(files_dir, directory);

	for (let name of fs.readdirSync(dirpath).sort()) {

		let buf = fs.readFileSync(path.join(dirpath, name));
		let rel = `files/${directory}/${name}`;

		if (expected !== null && is_valid_utf8(buf)) {
			failures++;
			if (Object.hasOwn(fails, expected)) {
				fails[expected].push([rel, "utf8"]);
			} else {
				fails[expected] = [[rel, "utf8"]];
			}
			continue;
		}

		let got = guess_charset(buf, LIMIT);

		file_count++;
		if (got !== expected) {
			failures++;

			if (Object.hasOwn(fails, expected)) {
				fails[expected].push([rel, got]);
			} else {
				fails[expected] = [[rel, got]];
			}
			continue;
		}
	}
}

console.log("=".repeat(80));
console.log(`file corpus:    (${file_count} files)`);
console.log("=".repeat(80));

for (let expected of Object.keys(fails)) {
	console.log(expected);
	for (let [rel, got] of fails[expected]) {
		console.log(`    --> ${got}, ${rel}`);
	}
}

// ------------------------------------------------------------------------------------------------
// Part 2: the latin1 sweep.

console.log();

const sweep_templates = [
	"(;GM[1]FF[4]PB[Xmile]PW[John];B[pd])",					// Word-initial, lowercase follows. (The hard case: X + m can form a CJK byte pair.)
	"(;GM[1]FF[4]PB[HervX]PW[John];B[pd])",					// Word-final, ] follows. (X + ] as a CJK pair would eat the closing bracket.)
	"(;GM[1]FF[4]PB[MXller]PW[John];B[pd])",				// Mid-word.
	"(;GM[1]FF[4]C[X la fin];B[pd])",						// Word-initial, space follows.
	"(;GM[1]FF[4]C[one X two];B[pd])",						// Isolated.
	"(;GM[1]FF[4]C[3X points de komi pour blanc];B[pd])",	// After a digit (e.g. 6½).
];

const enc_latin1 = get_encoder("latin1");
const dec_latin1 = new util.TextDecoder("latin1");

let sweep_count = 0;
let sweep_fails = [];

for (let b = 0xa0; b < 256; b++) {
	let ch = dec_latin1.decode(new Uint8Array([b]));
	for (let t of sweep_templates) {
		let text = t.replace("X", ch);
		let got = guess_charset(enc_latin1(text), LIMIT);
		sweep_count++;
		if (got !== null && got !== "latin1") {
			failures++;
			sweep_fails.push(`    FAIL: 0x${b.toString(16)} "${ch}" -> ${got} in ${text.slice(0, 40)}`);
		}
	}
}

console.log("=".repeat(80));
console.log(`latin1 sweep (${sweep_count} cases)`);
console.log("=".repeat(80));

if (sweep_fails.length === 0) {
	console.log("    OK");
} else {
	for (let s of sweep_fails) {
		console.log(sweep_fails);
	}
}

// ------------------------------------------------------------------------------------------------

console.log(failures === 0 ? "\nAll tests passed." : `\n${failures} FAILURES.`);
process.exit(failures === 0 ? 0 : 1);

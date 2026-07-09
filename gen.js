"use strict";

// Regenerates the corpus in files/ from the sample texts below. Run: node gen.js
//
// Each file is written in its actual target encoding; the directory it lives in
// names the charset that guess_charset() is expected to return for it, with
// "null" meaning the guesser should decline to guess (plain ASCII etc).
//
// Since guess_charset() is only ever consulted for buffers that are NOT valid
// UTF-8 (load_sgf checks first), every generated file outside null/ is asserted
// to be invalid UTF-8 -- a test file that happened to be valid UTF-8 would
// never reach the guesser in the real app, making its test meaningless.

const fs = require("fs");
const path = require("path");
const util = require("util");
const {get_encoder} = require("./lib/encoders");

const strict_utf8 = new util.TextDecoder("utf-8", {fatal: true});

// ------------------------------------------------------------------------------------------------
// The samples. Keys are directory (= expected guess_charset() result) then filename.

const samples = {

	"null": {
		"plain_ascii":				"(;GM[1]FF[4]PB[John Smith]PW[Jane Doe]C[A nice game of go. Black won by resignation.];B[pd])",
	},

	"windows-1252": {
		"german":					"(;GM[1]FF[4]PB[Jürgen Müller]PW[Björn Schäfer]C[Schöne Grüße aus München! Ein sehr schönes Spiel, Weiß hätte gewinnen können.];B[pd])",
		"french":					"(;GM[1]FF[4]PB[Hervé]PW[François]C[Très intéressant. À la fin, noir a gagné.];B[pd])",
		"french_minimal":			"(;GM[1]FF[4]PB[Émile]PW[John];B[pd])",									// Word-initial accent, minimal other signal.
		"french_name_only":			"(;GM[1]FF[4]PB[Émile Zola]PW[Jürgen]C[Kommentar];B[pd])",
		"spanish":					"(;GM[1]FF[4]PB[José María]PW[Ramón]C[¡Qué partida! El señor Muñoz ganó fácilmente.];B[pd])",
		"caps_accents":				"(;GM[1]FF[4]C[SÃO PAULO, TORNEO. ÉMILE contra JOSÉ.];B[pd])",
		"portuguese":				"(;GM[1]FF[4]PB[João]PW[Conceição]C[Uma ótima partida de go! Excelente decisão do preto.];B[pd])",
		"italian":					"(;GM[1]FF[4]PB[Niccolò]PW[Andrea]C[È una bella partita, perché il nero ha vinto così.];B[pd])",
		"swedish":					"(;GM[1]FF[4]PB[Åke Sjöberg]PW[Pär]C[Ett jättebra parti, svart vann till slut.];B[pd])",
		"danish":					"(;GM[1]FF[4]PB[Søren Kjær]PW[Bjørn]C[Et rigtig godt parti, sort vandt næsten.];B[pd])",
		"icelandic_short":			"(;GM[1]FF[4]PB[Þórður]PW[Guðrún]C[Þetta var æði! Svartur vann örugglega.];B[pd])",		// Word-initial Þ/æ/ð everywhere.
		"icelandic":				"(;GM[1]FF[4]PB[Þórður Ægir]PW[Guðrún Ósk]C[Þetta var æðislegt einvígi! Hvítur hefði getað unnið, en svartur vann örugglega að lokum.];B[pd])",
		"finnish":					"(;GM[1]FF[4]PB[Väinö Mäkelä]PW[Yrjö]C[Tämä oli hyvä peli, musta voitti selvästi.];B[pd])",
		"symbols":					"(;GM[1]FF[4]PB[John]PW[Jane]C[© 2003 Go Club. Komi: 6½ points. Result: W+2½. Café tournament.];B[pd])",
	},

	"windows-1251": {
		"russian":					"(;GM[1]FF[4]PB[Иванов Пётр]PW[Смирнова Анна]C[Комментарий к партии. Белые играли очень хорошо, но чёрные победили.];B[pd]C[Хороший ход в углу доски.])",
		"russian_names_only":		"(;GM[1]FF[4]PB[Иванов]PW[Петров];B[pd])",
		"russian_caps":				"(;GM[1]FF[4]C[ОЧЕНЬ ХОРОШАЯ ПАРТИЯ! ЧЁРНЫЕ ПОБЕДИЛИ. Комментарии писал Иванов, чёрные играли хорошо.];B[pd])",
		"russian_ascii_words":		"(;GM[1]FF[4]C[Анализ с помощью KataGo. Белые играли joseki правильно, но чёрные победили.];B[pd])",
		"russian_one_word":			"(;GM[1]FF[4]C[привет];B[pd])",
		"russian_escaped_bracket":	"(;GM[1]FF[4]C[Комментарий \\] со скобкой];B[pd];W[dd]C[Хороший ход];B[dp]C[Ещё один ход, всё хорошо])",
		"ukrainian":				"(;GM[1]FF[4]PB[Шевченко Тарас]C[Дуже цікава партія. Чорні грали дуже добре, і білі здалися.];B[pd])",
	},

	"koi8-r": {
		"russian":					"(;GM[1]FF[4]PB[Иванов Пётр]PW[Смирнова Анна]C[Комментарий к партии. Белые играли очень хорошо, но чёрные победили.];B[pd])",
		"russian_names_only":		"(;GM[1]FF[4]PB[Иванов]PW[Петров];B[pd])",
		"russian_names_heavy":		"(;GM[1]FF[4]C[Иванов Пётр Сергеевич против Смирновой Анны Павловны. Москва, Россия. Турнир Кубок Москвы.];B[pd])",	// Many capitalised words.
		"russian_ascii_words":		"(;GM[1]FF[4]C[Анализ с помощью KataGo. Белые играли joseki правильно, но чёрные победили.];B[pd])",
		"russian_one_word":			"(;GM[1]FF[4]C[привет];B[pd])",
	},

	"shift_jis": {
		"japanese":					"(;GM[1]FF[4]PB[小林光一]BR[九段]PW[武宮正樹]C[黒がいい手を打った。とても面白い対局です。];B[pd]C[この手は定石です。])",
		"japanese_ascii_words":		"(;GM[1]FF[4]PB[小林光一]C[KataGoによる解析です。黒がAIの推奨手を打った。とても面白い対局。];B[pd])",
	},

	"euc-jp": {
		"japanese":					"(;GM[1]FF[4]PB[小林光一]BR[九段]PW[武宮正樹]C[黒がいい手を打った。とても面白い対局です。];B[pd])",
		"japanese_ascii_words":		"(;GM[1]FF[4]PB[小林光一]C[KataGoによる解析。黒がAIの推奨手を打ちました。];B[pd])",
	},

	"gbk": {
		"chinese":					"(;GM[1]FF[4]PB[聂卫平]PW[马晓春]C[这是一盘非常精彩的对局，黑棋下得很好。];B[pd]C[这一手是定式。])",
		"chinese_ascii_words":		"(;GM[1]FF[4]PB[聂卫平]C[用KataGo分析了这盘棋，黑棋的AI胜率很高，下得很好。];B[pd])",
		"chinese_ascii_lower":		"(;GM[1]FF[4]C[黑棋应该下在tengen附近，这样更好。参考joseki变化。];B[pd])",
	},

	"euc-kr": {
		"korean":					"(;GM[1]FF[4]PB[이창호]PW[조훈현]C[아주 재미있는 대국입니다. 흑이 잘 두었습니다.];B[pd]C[이 수는 정석입니다.])",
		"korean_hanja_names":		"(;GM[1]FF[4]PB[李昌鎬]PW[曺薰鉉]C[아주 재미있는 대국입니다. 흑이 잘 두었습니다.];B[pd])",		// Hanja names, hangul comments.
		"korean_ascii_words":		"(;GM[1]FF[4]PB[이창호]C[KataGo로 분석한 대국입니다. 흑이 AI 추천수를 두었습니다.];B[pd])",
	},

	"big5": {
		"chinese":					"(;GM[1]FF[4]PB[周俊勳]PW[王元均]C[這是一盤非常精彩的對局，黑棋下得很好。];B[pd])",
		"chinese_ascii_words":		"(;GM[1]FF[4]PB[周俊勳]C[用KataGo分析這盤棋，黑棋的AI勝率很高。];B[pd])",
	},

};

// Dirty files: genuine content with stray invalid bytes inserted, mimicking corruption
// or nonstandard vendor bytes in old files. The guesser should still get these right.
// Each entry: [directory, new filename, source filename, bytes to insert (spread out)].

const dirty = [
	["shift_jis",	"japanese_dirty",	"japanese",	[0x80, 0x80]],
	["euc-kr",		"korean_dirty",		"korean",	[0x80]],
];

// ------------------------------------------------------------------------------------------------

function is_valid_utf8(buf) {
	try {
		strict_utf8.decode(buf);
		return true;
	} catch (err) {
		return false;
	}
}

function insert_spread(u8, bytes) {
	let arr = [...u8];
	let step = Math.floor(arr.length / (bytes.length + 1));
	for (let i = 0; i < bytes.length; i++) {
		arr.splice((i + 1) * step + i, 0, bytes[i]);
	}
	return new Uint8Array(arr);
}

let count = 0;

for (let [directory, files] of Object.entries(samples)) {
	let dirpath = path.join(__dirname, "files", directory);
	fs.mkdirSync(dirpath, {recursive: true});
	let encode = (directory === "null") ? (s => new TextEncoder().encode(s)) : get_encoder(directory);
	for (let [name, text] of Object.entries(files)) {
		let buf = encode(text);
		if (directory !== "null" && is_valid_utf8(buf)) {
			throw new Error(`${directory}/${name} is valid UTF-8 and would never reach the guesser -- change the sample.`);
		}
		fs.writeFileSync(path.join(dirpath, name + ".sgf"), buf);
		count++;
	}
}

for (let [directory, name, source, bytes] of dirty) {
	let src = fs.readFileSync(path.join(__dirname, "files", directory, source + ".sgf"));
	fs.writeFileSync(path.join(__dirname, "files", directory, name + ".sgf"), insert_spread(src, bytes));
	count++;
}

console.log(`Wrote ${count} files.`);

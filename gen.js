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

	"latin1": {
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
		"russian_short_comment":	"(;GM[1]FF[4]C[Чёрные хорошо сыграли в углу, и белые сдались.];B[pd])",
		"russian_full_names":		"(;GM[1]FF[4]PB[Иванов Пётр]PW[Смирнова Анна];B[pd])",
		"caps_only":					"(;GM[1]FF[4]C[ЧЁРНЫЕ ПОБЕДИЛИ];B[pd])",		// Caps in one Cyrillic charset are lowercase in the other.
	},

	"koi8-r": {
		"russian":					"(;GM[1]FF[4]PB[Иванов Пётр]PW[Смирнова Анна]C[Комментарий к партии. Белые играли очень хорошо, но чёрные победили.];B[pd])",
		"russian_names_only":		"(;GM[1]FF[4]PB[Иванов]PW[Петров];B[pd])",
		"russian_names_heavy":		"(;GM[1]FF[4]C[Иванов Пётр Сергеевич против Смирновой Анны Павловны. Москва, Россия. Турнир Кубок Москвы.];B[pd])",	// Many capitalised words.
		"russian_ascii_words":		"(;GM[1]FF[4]C[Анализ с помощью KataGo. Белые играли joseki правильно, но чёрные победили.];B[pd])",
		"russian_one_word":			"(;GM[1]FF[4]C[привет];B[pd])",
		"russian_short_comment":	"(;GM[1]FF[4]C[Чёрные хорошо сыграли в углу, и белые сдались.];B[pd])",
		"russian_full_names":		"(;GM[1]FF[4]PB[Иванов Пётр]PW[Смирнова Анна];B[pd])",
		"caps_only":					"(;GM[1]FF[4]C[ЧЕРНЫЕ ПОБЕДИЛИ];B[pd])",		// Caps in one Cyrillic charset are lowercase in the other.
	},

	"shift_jis": {
		"japanese":					"(;GM[1]FF[4]PB[小林光一]BR[九段]PW[武宮正樹]C[黒がいい手を打った。とても面白い対局です。];B[pd]C[この手は定石です。])",
		"japanese_ascii_words":		"(;GM[1]FF[4]PB[小林光一]C[KataGoによる解析です。黒がAIの推奨手を打った。とても面白い対局。];B[pd])",
		"japanese_short_comment":	"(;GM[1]FF[4]C[黒は右上隅で良い手を打った。白は投了した。];B[pd])",
		"japanese_event":			"(;GM[1]FF[4]EV[東京囲碁大会]PB[小林光一]PW[加藤正夫];B[pd])",
		"japanese_names_only":		"(;GM[1]FF[4]PB[小林光一]PW[武宮正樹];B[pd])",
	},

	"euc-jp": {
		"japanese":					"(;GM[1]FF[4]PB[小林光一]BR[九段]PW[武宮正樹]C[黒がいい手を打った。とても面白い対局です。];B[pd])",
		"japanese_ranked_names_only":	"(;GM[1]FF[4]PB[井山裕太]BR[九段]PW[一力遼]WR[九段];B[pd])",			// Kanji-only, but the Japanese rank notation is decisive.
		"japanese_digit_ranked_names_only":	"(;GM[1]FF[4]PB[小林光一]BR[3段]PW[武宮正樹]WR[9段];B[pd])",	// Rescued by the ascii-digit rank rule.
		"japanese_ascii_words":		"(;GM[1]FF[4]PB[小林光一]C[KataGoによる解析。黒がAIの推奨手を打ちました。];B[pd])",
		"japanese_short_comment":		"(;GM[1]FF[4]C[黒は右上隅で良い手を打った。白は投了した。];B[pd])",
		"kanji_names_only":			"(;GM[1]FF[4]PB[小林光一]PW[武宮正樹];B[pd])",				// Kanji-only content has no kana, so EUC-JP can't
		"kanji_names_only_2":			"(;GM[1]FF[4]PB[趙治勲]PW[加藤正夫];B[pd])",					// be told from GBK / EUC-KR etc, whose byte
		"kanji_names_only_3":			"(;GM[1]FF[4]PB[井山裕太]PW[張栩];B[pd])",					// structure is the same.
		"kanji_names_only_4":			"(;GM[1]FF[4]PB[大竹英雄]PW[林海峰];B[pd])",
		"kanji_event":					"(;GM[1]FF[4]EV[棋聖戦]PB[小林光一]PW[武宮正樹];B[pd])",
		"kanji_game_info":				"(;GM[1]FF[4]GN[第十局]PB[小林光一]PW[武宮正樹]RE[B+R];B[pd])",
	},

	"gbk": {
		"chinese":					"(;GM[1]FF[4]PB[聂卫平]PW[马晓春]C[这是一盘非常精彩的对局，黑棋下得很好。];B[pd]C[这一手是定式。])",
		"chinese_modern_names_only":	"(;GM[1]FF[4]PB[柯洁]PW[丁浩];B[pd])",							// Plausible minimal record currently mistaken for EUC-KR.
		"chinese_ascii_words":		"(;GM[1]FF[4]PB[聂卫平]C[用KataGo分析了这盘棋，黑棋的AI胜率很高，下得很好。];B[pd])",
		"chinese_ascii_lower":		"(;GM[1]FF[4]C[黑棋应该下在tengen附近，这样更好。参考joseki变化。];B[pd])",
		"chinese_comment":			"(;GM[1]FF[4]C[黑棋在右上角下了一手好棋，白棋随后认输。];B[pd])",
		"chinese_event":			"(;GM[1]FF[4]EV[北京围棋公开赛]PB[常昊]PW[古力]C[这是一盘精彩的对局。];B[pd])",
		"chinese_names_only":		"(;GM[1]FF[4]PB[聂卫平]PW[马晓春];B[pd])",
	},

	"euc-kr": {
		"korean":					"(;GM[1]FF[4]PB[이창호]PW[조훈현]C[아주 재미있는 대국입니다. 흑이 잘 두었습니다.];B[pd]C[이 수는 정석입니다.])",
		"korean_hanja_names":		"(;GM[1]FF[4]PB[李昌鎬]PW[曺薰鉉]C[아주 재미있는 대국입니다. 흑이 잘 두었습니다.];B[pd])",		// Hanja names, hangul comments.
		"korean_ascii_words":		"(;GM[1]FF[4]PB[이창호]C[KataGo로 분석한 대국입니다. 흑이 AI 추천수를 두었습니다.];B[pd])",
		"korean_short_comment":			"(;GM[1]FF[4]C[흑은 우상귀에서 좋은 수를 두었고 백은 곧 기권했다.];B[pd])",
		"korean_names_only":			"(;GM[1]FF[4]PB[이창호]PW[조훈현];B[pd])",
		"hanja_names_only":			"(;GM[1]FF[4]PB[李昌鎬]PW[曺薰鉉];B[pd])",					// Hanja-only content has no hangul, i.e. no
		"hanja_names_only_2":			"(;GM[1]FF[4]PB[劉昌赫]PW[徐奉洙];B[pd])",					// Korean signal at all.
		"hanja_event":					"(;GM[1]FF[4]EV[韓國棋院]PB[李昌鎬]PW[曺薰鉉];B[pd])",
	},

	"big5": {
		"chinese":					"(;GM[1]FF[4]PB[周俊勳]PW[王元均]C[這是一盤非常精彩的對局，黑棋下得很好。];B[pd])",
		"chinese_modern_names_only":	"(;GM[1]FF[4]PB[許皓鋐]PW[黑嘉嘉];B[pd])",						// Plausible minimal record currently mistaken for GBK.
		"chinese_ascii_words":		"(;GM[1]FF[4]PB[周俊勳]C[用KataGo分析這盤棋，黑棋的AI勝率很高。];B[pd])",
		"chinese_comment":			"(;GM[1]FF[4]C[黑棋在右上角下了一手好棋。白棋隨後投子認輸。];B[pd])",
		"chinese_event":			"(;GM[1]FF[4]EV[台北圍棋公開賽]PB[林海峰]PW[王立誠]C[這是一盤精彩的對局。];B[pd])",
		"chinese_names_only":		"(;GM[1]FF[4]PB[林海峰]PW[王立誠];B[pd])",
		"chinese_names_only_2":		"(;GM[1]FF[4]PB[陳志明]PW[林國華]RE[B+R];B[pd])",
		"chinese_strategy_comment":	"(;GM[1]FF[4]C[實戰黑棋選擇在右上角進行攻擊，白棋應該先補強弱棋。];B[pd])",
		"chinese_tournament_comment": "(;GM[1]FF[4]C[本局於台北棋院舉行，雙方布局平穩，最後黑棋中盤勝。];B[pd])",
		"chinese_minimal":			"(;GM[1]FF[4]PB[黑棋]PW[白棋]C[黑棋好手。];B[pd])",
		"chinese_short_comment":	"(;GM[1]FF[4]C[黑棋好手，白棋認輸。];B[pd])",
		"chinese_short_event":		"(;GM[1]FF[4]EV[台北棋賽]PB[王立誠]PW[林海峰];B[pd])",
		"gbk_compatible_han":			"(;GM[1]FF[4]C[實戰黑棋進擊 黑棋勝];B[pd])",					// Hanzi whose Big5 bytes are also valid GBK.
	},

};

// Dirty files: genuine content with stray invalid bytes inserted, mimicking corruption
// or nonstandard vendor bytes in old files. The guesser should still get these right.
// Each entry: [directory, new filename, source filename, bytes to insert (spread out)].

const dirty = [
	["shift_jis",	"japanese_dirty",	"japanese",	[0x80, 0x80]],
	["euc-kr",		"korean_dirty",		"korean",	[0x80]],
];

// UTF-8 samples: these only reach the guesser when they are NOT valid UTF-8 (load_sgf
// checks first), so all of them get stray bytes inserted -- either corruption (0x80) or
// a latin1-encoded byte pasted in by some old editor (0xE9 = é). A clean sample would be
// pointless, and is rejected below. Each entry: [filename, text, bytes to insert].

const utf8_dirty = [
	["russian_dirty",		"(;GM[1]FF[4]PB[Иванов Пётр]PW[Смирнова Анна]C[Комментарий к партии. Белые играли очень хорошо, но чёрные победили.];B[pd])",	[0x80]],
	["russian_dirty_2",		"(;GM[1]FF[4]PB[Иванов Пётр]PW[Смирнова Анна]C[Комментарий к партии. Белые играли очень хорошо, но чёрные победили.];B[pd])",	[0x80, 0x80, 0x80]],
	["japanese_dirty",		"(;GM[1]FF[4]PB[小林光一]BR[九段]PW[武宮正樹]C[黒がいい手を打った。とても面白い対局です。];B[pd])",	[0x80]],
	["chinese_dirty",		"(;GM[1]FF[4]PB[聂卫平]PW[马晓春]C[这是一盘非常精彩的对局，黑棋下得很好。];B[pd])",	[0x80, 0x80]],
	["korean_dirty",		"(;GM[1]FF[4]PB[이창호]PW[조훈현]C[아주 재미있는 대국입니다. 흑이 잘 두었습니다.];B[pd])",	[0x80, 0x80]],
	["german_dirty",		"(;GM[1]FF[4]PB[Jürgen Müller]C[Schöne Grüße aus München, Weiß hätte gewinnen können.];B[pd])",	[0x80]],
	["latin1_byte_pasted",	"(;GM[1]FF[4]PB[Andre]PW[Иванов]C[Комментарий к партии, чёрные победили.];B[pd])",	[0xe9]],
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

fs.mkdirSync(path.join(__dirname, "files", "utf-8"), {recursive: true});

for (let [name, text, bytes] of utf8_dirty) {
	let buf = insert_spread(new TextEncoder().encode(text), bytes);
	if (is_valid_utf8(buf)) {
		throw new Error(`utf-8/${name} came out valid UTF-8 -- pointless, see the note on utf8_dirty.`);
	}
	fs.writeFileSync(path.join(__dirname, "files", "utf-8", name + ".sgf"), buf);
	count++;
}

console.log(`Wrote ${count} files.`);

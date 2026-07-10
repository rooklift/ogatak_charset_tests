# ogatak_charset_tests

Test corpus and runner for [ogatak](https://github.com/rooklift/ogatak)'s SGF charset
guesser (`src/modules/guess_charset.js`).

## Layout

```
files/<expected>/*.sgf    test files, each saved in its actual legacy encoding
test.js                   the test runner
gen.js                    regenerates files/ from sample texts embedded in it
lib/encoders.js           legacy-charset encoders (Node only ships decoders)
```

Each subdirectory of `files/` is named for the charset that `guess_charset()` is
expected to return for the files inside it. The special directory `null` holds files
for which the guesser should decline to guess (plain ASCII -- in the real app such
files are valid UTF-8 and never reach the guesser anyway).

Files named `ambiguous_*` carry no expectation: their content is inherently ambiguous
(kanji-only bytes carry no Japanese-vs-Chinese signal, hanja-only Korean has no hangul
to detect, all-caps Cyrillic reads as valid lowercase in the other Cyrillic charset,
and some Big5 byte sequences are also clean GBK). The runner just reports what the
guesser says about them, while their directory records their true encoding.

## Running

Requires an ogatak checkout as a **sibling directory** of this repo:

```
parent/
  ogatak/
  ogatak_charset_tests/
```

Then, from this repo's root:

```
node test.js
```

Alternatively, point it at the guesser directly:

```
node test.js path/to/guess_charset.js
```

Exits 0 if everything passes, 1 otherwise, printing a line per failure. As well as
the file corpus, the runner sweeps every windows-1252 character 0xA0-0xFF through
several in-file contexts, requiring that none of them is guessed as anything but
windows-1252 (or null): SGF's default charset is Latin-1, so misguessing sensible
Latin-1 content is the one mistake the guesser must never make.

## Adding tests

Either drop an `.sgf` file (in its real encoding) into the appropriate
`files/<expected>/` directory, or add its text to `gen.js` and run `node gen.js`
to regenerate the corpus. `gen.js` refuses to write a non-ASCII sample that
accidentally comes out as valid UTF-8, since such a file would never reach the
guesser in the real app.

The corpus deliberately includes known-hard cases: word-initial accents with minimal
other signal (`PB[Émile]`), Icelandic (word-initial Þ/æ/ð everywhere), all-caps
accented text, CJK and Cyrillic text with embedded ASCII words like "KataGo" and
"joseki", Korean with hanja player names, short name-only files, escaped `]`
characters, and files with a few corrupt bytes that the guesser should tolerate.
Name a file `ambiguous_*` if its content genuinely underdetermines its charset --
it will be reported rather than judged.

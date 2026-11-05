//! Minimal reader and writer for gettext PO files. Long strings are not wrapped, and the comments other than the
//! references are kept as they are.

use std::fmt::{self, Write};

#[derive(Debug, Default, Clone, PartialEq)]
pub struct Entry {
	/// Comment lines other than the references, including the "#" prefix.
	pub comments: Vec<String>,
	/// References ("#:" comments).
	pub references: Vec<String>,
	pub msgctxt: Option<String>,
	pub msgid: String,
	pub msgid_plural: Option<String>,
	/// The translation, or one translation for each plural form.
	pub msgstr: Vec<String>,
	pub obsolete: bool,
}

impl Entry {
	pub fn new(msgid: String) -> Self {
		Self {
			msgid,
			msgstr: vec![String::new()],
			..Default::default()
		}
	}

	fn is_header(&self) -> bool {
		self.msgid.is_empty() && self.msgctxt.is_none() && !self.obsolete
	}
}

#[derive(Debug, Default, PartialEq)]
pub struct PoFile {
	pub header: Option<Entry>,
	pub entries: Vec<Entry>,
}

#[derive(Clone, Copy, PartialEq)]
enum Field {
	None,
	Msgctxt,
	Msgid,
	MsgidPlural,
	Msgstr(usize),
}

fn unescape(text: &str, line: usize) -> Result<String, String> {
	let error = |message: &str| Err(format!("{message} on line {line}"));
	let Some(inner) = text.strip_prefix('"').and_then(|text| text.strip_suffix('"')) else {
		return error("Invalid string");
	};
	let mut result = String::with_capacity(inner.len());
	let mut chars = inner.chars();
	while let Some(c) = chars.next() {
		match c {
			'\\' => result.push(match chars.next() {
				Some('n') => '\n',
				Some('t') => '\t',
				Some('r') => '\r',
				Some('a') => '\x07',
				Some('b') => '\x08',
				Some('v') => '\x0b',
				Some('f') => '\x0c',
				Some(c @ ('\\' | '"' | '\'' | '?')) => c,
				_ => return error("Invalid escape sequence"),
			}),
			'"' => return error("Unescaped quote"),
			_ => result.push(c),
		}
	}
	Ok(result)
}

fn escape(text: &str, out: &mut String) {
	for c in text.chars() {
		match c {
			'\\' => out.push_str("\\\\"),
			'"' => out.push_str("\\\""),
			'\n' => out.push_str("\\n"),
			'\t' => out.push_str("\\t"),
			'\r' => out.push_str("\\r"),
			'\x07' => out.push_str("\\a"),
			'\x08' => out.push_str("\\b"),
			'\x0b' => out.push_str("\\v"),
			'\x0c' => out.push_str("\\f"),
			_ => out.push(c),
		}
	}
}

struct Parser {
	file: PoFile,
	entry: Entry,
	field: Field,
}

impl Parser {
	/// Whether the current entry already has a message, so the next comment or msgctxt/msgid starts a new entry.
	fn has_message(&self) -> bool {
		!self.entry.msgstr.is_empty()
	}

	fn finish_entry(&mut self) {
		if self.has_message() {
			let entry = std::mem::take(&mut self.entry);
			if self.file.header.is_none() && self.file.entries.is_empty() && entry.is_header() {
				self.file.header = Some(entry);
			} else {
				self.file.entries.push(entry);
			}
		}
		self.field = Field::None;
	}

	fn keyword(&mut self, line: &str, number: usize, obsolete: bool) -> Result<(), String> {
		let (keyword, value) = line.split_once(' ').unwrap_or((line, ""));
		let value = unescape(value.trim(), number)?;
		let field = match keyword {
			"msgctxt" => Field::Msgctxt,
			"msgid" => Field::Msgid,
			"msgid_plural" => Field::MsgidPlural,
			"msgstr" => Field::Msgstr(0),
			_ => match keyword.strip_prefix("msgstr[").and_then(|rest| rest.strip_suffix(']')) {
				Some(index) => Field::Msgstr(
					index
						.parse()
						.map_err(|_| format!("Invalid plural index on line {number}"))?,
				),
				None => return Err(format!("Unknown keyword \"{keyword}\" on line {number}")),
			},
		};
		if matches!(field, Field::Msgctxt | Field::Msgid) && self.has_message() {
			self.finish_entry();
		}
		if obsolete {
			self.entry.obsolete = true;
		}
		match field {
			Field::Msgctxt => self.entry.msgctxt = Some(value),
			Field::Msgid => self.entry.msgid = value,
			Field::MsgidPlural => self.entry.msgid_plural = Some(value),
			Field::Msgstr(index) => {
				if index != self.entry.msgstr.len() {
					return Err(format!("Unexpected plural index on line {number}"));
				}
				self.entry.msgstr.push(value);
			}
			Field::None => unreachable!(),
		}
		self.field = field;
		Ok(())
	}

	fn continuation(&mut self, line: &str, number: usize) -> Result<(), String> {
		let value = unescape(line, number)?;
		let target = match self.field {
			Field::None => return Err(format!("Unexpected string on line {number}")),
			Field::Msgctxt => self.entry.msgctxt.as_mut().unwrap(),
			Field::Msgid => &mut self.entry.msgid,
			Field::MsgidPlural => self.entry.msgid_plural.as_mut().unwrap(),
			Field::Msgstr(index) => &mut self.entry.msgstr[index],
		};
		target.push_str(&value);
		Ok(())
	}

	fn line(&mut self, line: &str, number: usize) -> Result<(), String> {
		if line.is_empty() {
			self.finish_entry();
		} else if let Some(rest) = line.strip_prefix("#~") {
			let rest = rest.trim_start();
			if rest.starts_with('"') {
				self.continuation(rest, number)?;
			} else if rest.starts_with('|') {
				// previous values of obsolete entries are kept as comments
				self.comment(line);
			} else {
				self.keyword(rest, number, true)?;
			}
		} else if line.starts_with('#') {
			self.comment(line);
		} else if line.starts_with('"') {
			self.continuation(line, number)?;
		} else {
			self.keyword(line, number, false)?;
		}
		Ok(())
	}

	fn comment(&mut self, line: &str) {
		if self.has_message() {
			self.finish_entry();
		}
		self.field = Field::None;
		match line.strip_prefix("#:") {
			Some(references) => self
				.entry
				.references
				.extend(references.split_whitespace().map(String::from)),
			None => self.entry.comments.push(line.to_string()),
		}
	}
}

pub fn parse(text: &str) -> Result<PoFile, String> {
	let mut parser = Parser {
		file: PoFile::default(),
		entry: Entry::default(),
		field: Field::None,
	};
	for (index, line) in text.lines().enumerate() {
		parser.line(line.trim_end(), index + 1)?;
	}
	parser.finish_entry();
	Ok(parser.file)
}

fn write_string(out: &mut String, prefix: &str, keyword: &str, value: &str) {
	out.push_str(prefix);
	out.push_str(keyword);
	// strings with line breaks are split after each one
	if value.contains('\n') && value != "\n" {
		out.push_str(" \"\"\n");
		for line in value.split_inclusive('\n') {
			out.push_str(prefix);
			out.push('"');
			escape(line, out);
			out.push_str("\"\n");
		}
	} else {
		out.push_str(" \"");
		escape(value, out);
		out.push_str("\"\n");
	}
}

fn write_entry(out: &mut String, entry: &Entry) {
	// translator and extracted comments go before the references, flags and previous values after
	let (after, before): (Vec<_>, Vec<_>) = entry
		.comments
		.iter()
		.partition(|comment| comment.starts_with("#,") || comment.starts_with("#|") || comment.starts_with("#~|"));
	for comment in before {
		out.push_str(comment);
		out.push('\n');
	}
	for reference in &entry.references {
		let _ = writeln!(out, "#: {reference}");
	}
	for comment in after {
		out.push_str(comment);
		out.push('\n');
	}
	let prefix = if entry.obsolete { "#~ " } else { "" };
	if let Some(msgctxt) = &entry.msgctxt {
		write_string(out, prefix, "msgctxt", msgctxt);
	}
	write_string(out, prefix, "msgid", &entry.msgid);
	match &entry.msgid_plural {
		Some(plural) => {
			write_string(out, prefix, "msgid_plural", plural);
			for (index, msgstr) in entry.msgstr.iter().enumerate() {
				write_string(out, prefix, &format!("msgstr[{index}]"), msgstr);
			}
		}
		None => write_string(out, prefix, "msgstr", entry.msgstr.first().map_or("", String::as_str)),
	}
}

impl fmt::Display for PoFile {
	fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
		let mut out = String::new();
		for entry in self.header.iter().chain(&self.entries) {
			if !out.is_empty() {
				out.push('\n');
			}
			write_entry(&mut out, entry);
		}
		f.write_str(&out)
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	const SAMPLE: &str = r#"# Translator comment
msgid ""
msgstr ""
"Language: fr\n"
"Content-Type: text/plain; charset=utf-8\n"

#: abc
#: def
msgid "Hello {name}"
msgstr "Bonjour {name}"

#. extracted
#: 123
#, fuzzy
msgctxt "menu"
msgid "Quote \" backslash \\ tab \t"
msgstr ""

msgid "Line one\nLine two"
msgstr ""
"Ligne un\n"
"Ligne deux"

msgid "One item"
msgid_plural "{n} items"
msgstr[0] "Un élément"
msgstr[1] "{n} éléments"

#: old
#~ msgid "Obsolete"
#~ msgstr "Obsolète"
"#;

	#[test]
	fn parses_entries() {
		let file = parse(SAMPLE).unwrap();
		let header = file.header.as_ref().unwrap();
		assert_eq!(header.comments, vec!["# Translator comment"]);
		assert_eq!(
			header.msgstr,
			vec!["Language: fr\nContent-Type: text/plain; charset=utf-8\n"]
		);

		let entries = &file.entries;
		assert_eq!(entries.len(), 5);
		assert_eq!(entries[0].references, vec!["abc", "def"]);
		assert_eq!(entries[0].msgstr, vec!["Bonjour {name}"]);
		assert_eq!(entries[1].comments, vec!["#. extracted", "#, fuzzy"]);
		assert_eq!(entries[1].msgctxt.as_deref(), Some("menu"));
		assert_eq!(entries[1].msgid, "Quote \" backslash \\ tab \t");
		assert_eq!(entries[2].msgid, "Line one\nLine two");
		assert_eq!(entries[2].msgstr, vec!["Ligne un\nLigne deux"]);
		assert_eq!(entries[3].msgid_plural.as_deref(), Some("{n} items"));
		assert_eq!(entries[3].msgstr, vec!["Un élément", "{n} éléments"]);
		assert!(entries[4].obsolete);
		assert_eq!(entries[4].references, vec!["old"]);
		assert_eq!(entries[4].msgstr, vec!["Obsolète"]);
	}

	#[test]
	fn writes_what_it_reads() {
		let file = parse(SAMPLE).unwrap();
		let written = file.to_string();
		assert_eq!(
			written,
			SAMPLE.replace("Line one\\nLine two\"", "\"\n\"Line one\\n\"\n\"Line two\"")
		);
		assert_eq!(parse(&written).unwrap(), file);
	}

	#[test]
	fn splits_references_and_continuations() {
		let file = parse("#: a b\n#:c\nmsgid \"\"\n\"split \"\n\"value\"\nmsgstr \"\"\n").unwrap();
		assert_eq!(file.header, None);
		assert_eq!(file.entries[0].references, vec!["a", "b", "c"]);
		assert_eq!(file.entries[0].msgid, "split value");
	}

	#[test]
	fn handles_crlf_and_missing_final_line_break() {
		let file = parse("msgid \"a\"\r\nmsgstr \"b\"").unwrap();
		assert_eq!(
			file.entries,
			vec![Entry {
				msgstr: vec!["b".into()],
				..Entry::new("a".into())
			}]
		);
	}

	#[test]
	fn reports_syntax_errors() {
		assert_eq!(parse("msgid a\n"), Err("Invalid string on line 1".into()));
		assert_eq!(
			parse("msgid \"\\q\"\n"),
			Err("Invalid escape sequence on line 1".into())
		);
		assert_eq!(parse("msgid \"a\"b\"\n"), Err("Unescaped quote on line 1".into()));
		assert_eq!(parse("foo \"a\"\n"), Err("Unknown keyword \"foo\" on line 1".into()));
		assert_eq!(parse("\"a\"\n"), Err("Unexpected string on line 1".into()));
		assert_eq!(
			parse("msgid \"a\"\nmsgstr[1] \"b\"\n"),
			Err("Unexpected plural index on line 2".into())
		);
		assert_eq!(
			parse("msgid \"a\"\nmsgstr[x] \"b\"\n"),
			Err("Invalid plural index on line 2".into())
		);
	}

	#[test]
	fn escapes_control_characters() {
		let mut out = String::new();
		escape("\x07\x08\x0b\x0c\r", &mut out);
		assert_eq!(out, "\\a\\b\\v\\f\\r");
		assert_eq!(unescape(r#""\a\b\v\f\r\'\?""#, 1).unwrap(), "\x07\x08\x0b\x0c\r'?");
	}
}

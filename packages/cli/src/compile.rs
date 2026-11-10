//! Compiles the PO catalogs into the modules loaded by `@bluecateng/l10n-core`, the same way as
//! `@bluecateng/l10n-icu2obj`.

use std::{
	collections::HashMap,
	fs,
	path::{Component, Path, PathBuf},
};

use formatjs_icu_messageformat_parser::{
	types::{DateTimeSkeletonOrStyle, MessageFormatElement, NumberSkeletonOrStyle, PluralType, ValidPluralRule},
	Parser, ParserError, ParserOptions,
};
use l10n_macro::{js_number, KeyBuilder};

use crate::{
	config::{resolve, Config},
	po,
};

// token types, see @bluecateng/l10n-types
const ARGUMENT: i64 = 1;
const SELECT: i64 = 2;
const CARDINAL: i64 = 3;
const ORDINAL: i64 = 4;
const OCTOTHORPE: i64 = 5;
const NUMBER: i64 = 6;
const DATE: i64 = 7;
const TIME: i64 = 8;

#[derive(Debug, PartialEq)]
enum Value {
	Str(String),
	Num(f64),
	Arr(Vec<Value>),
	/// Entries in insertion order, written in the same order as `JSON.stringify` would.
	Obj(Vec<(String, Value)>),
}

/// Whether JavaScript treats the key as an array index, those keys are listed first in ascending order.
fn is_index(key: &str) -> bool {
	key == "0"
		|| (!key.starts_with('0')
			&& key.bytes().all(|b| b.is_ascii_digit())
			&& key.parse::<u32>().is_ok_and(|n| n != u32::MAX))
}

fn write_json(value: &Value, out: &mut String) {
	match value {
		Value::Str(string) => out.push_str(&serde_json::to_string(string).unwrap()),
		Value::Num(number) => out.push_str(&js_number(*number)),
		Value::Arr(items) => {
			out.push('[');
			for (index, item) in items.iter().enumerate() {
				if index > 0 {
					out.push(',');
				}
				write_json(item, out);
			}
			out.push(']');
		}
		Value::Obj(entries) => {
			// a repeated key replaces the previous value but keeps its position
			let mut unique: Vec<(&String, &Value)> = Vec::with_capacity(entries.len());
			let mut positions: HashMap<&String, usize> = HashMap::with_capacity(entries.len());
			for (key, value) in entries {
				match positions.get(key) {
					Some(&position) => unique[position].1 = value,
					None => {
						positions.insert(key, unique.len());
						unique.push((key, value));
					}
				}
			}
			let mut indexes: Vec<_> = unique.iter().filter(|(key, _)| is_index(key)).collect();
			indexes.sort_by_key(|(key, _)| key.parse::<u32>().unwrap());
			let others = unique.iter().filter(|(key, _)| !is_index(key));
			out.push('{');
			for (index, (key, value)) in indexes.into_iter().chain(others).enumerate() {
				if index > 0 {
					out.push(',');
				}
				out.push_str(&serde_json::to_string(key).unwrap());
				out.push(':');
				write_json(value, out);
			}
			out.push('}');
		}
	}
}

fn format_error(error: &ParserError) -> String {
	let kind = error.kind.to_string().to_lowercase().replace('_', " ");
	let start = &error.location.start;
	format!("{kind} at {}:{}", start.line, start.column)
}

fn function(kind: i64, name: &str, style: Option<String>) -> Value {
	let mut token = vec![Value::Num(kind as f64), Value::Str(name.into())];
	token.extend(style.map(Value::Str));
	Value::Arr(token)
}

fn plural_key(rule: &ValidPluralRule, kind: &str) -> Result<String, String> {
	match rule {
		ValidPluralRule::Exact(key) => match key.strip_prefix('=') {
			Some(digits) if !digits.is_empty() && digits.bytes().all(|b| b.is_ascii_digit()) => {
				Ok(js_number(digits.parse().unwrap()))
			}
			_ => Err(format!("the {kind} case {key} is not valid")),
		},
		rule => Ok(rule.as_str().into()),
	}
}

fn convert_elements(elements: &[MessageFormatElement]) -> Result<Value, String> {
	let mut tokens: Vec<Value> = vec![];
	for element in elements {
		let token = match element {
			MessageFormatElement::Literal(literal) => {
				// adjacent literals are merged, the parser splits them around quoted text
				if let Some(Value::Str(previous)) = tokens.last_mut() {
					previous.push_str(&literal.value);
					continue;
				}
				Value::Str(literal.value.clone())
			}
			MessageFormatElement::Argument(argument) => {
				Value::Arr(vec![Value::Num(ARGUMENT as f64), Value::Str(argument.value.clone())])
			}
			MessageFormatElement::Pound(_) => Value::Arr(vec![Value::Num(OCTOTHORPE as f64)]),
			MessageFormatElement::Number(number) => {
				let style = match &number.style {
					Some(NumberSkeletonOrStyle::String(style)) => Some(style.clone()),
					Some(NumberSkeletonOrStyle::Skeleton(_)) => return Err("number skeletons are not supported".into()),
					None => None,
				};
				function(NUMBER, &number.value, style)
			}
			MessageFormatElement::Date(date) | MessageFormatElement::Time(date) => {
				let style = match &date.style {
					Some(DateTimeSkeletonOrStyle::String(style)) => Some(style.clone()),
					Some(DateTimeSkeletonOrStyle::Skeleton(_)) => {
						return Err("date and time skeletons are not supported".into())
					}
					None => None,
				};
				let kind = if matches!(element, MessageFormatElement::Date(_)) {
					DATE
				} else {
					TIME
				};
				function(kind, &date.value, style)
			}
			MessageFormatElement::Select(select) => {
				let cases = select
					.options
					.iter()
					.map(|(key, option)| Ok((key.clone(), convert_elements(&option.value)?)))
					.collect::<Result<_, String>>()?;
				Value::Arr(vec![
					Value::Num(SELECT as f64),
					Value::Str(select.value.clone()),
					Value::Obj(cases),
				])
			}
			MessageFormatElement::Plural(plural) => {
				let (kind, name) = match plural.plural_type {
					PluralType::Cardinal => (CARDINAL, "plural"),
					PluralType::Ordinal => (ORDINAL, "selectordinal"),
				};
				let mut cases = vec![];
				if plural.offset != 0 {
					cases.push(("offset".to_string(), Value::Num(plural.offset.into())));
				}
				for (rule, option) in &plural.options {
					cases.push((plural_key(rule, name)?, convert_elements(&option.value)?));
				}
				Value::Arr(vec![
					Value::Num(kind as f64),
					Value::Str(plural.value.clone()),
					Value::Obj(cases),
				])
			}
			// tags are parsed as literals
			MessageFormatElement::Tag(_) => unreachable!(),
		};
		tokens.push(token);
	}
	Ok(match tokens.as_slice() {
		[] => Value::Str(String::new()),
		[Value::Str(_)] => tokens.pop().unwrap(),
		_ => Value::Arr(tokens),
	})
}

/// Converts an ICU message to the format used by `@bluecateng/l10n-core`.
fn convert(message: &str) -> Result<Value, String> {
	let options = ParserOptions {
		ignore_tag: true,
		requires_other_clause: false,
		..Default::default()
	};
	let elements = Parser::new(message, options)
		.parse()
		.map_err(|error| format_error(&error))?;
	convert_elements(&elements)
}

fn language(header: Option<&po::Entry>) -> Option<&str> {
	header?.msgstr.first()?.lines().find_map(|line| {
		let (name, value) = line.split_once(':')?;
		let value = value.trim();
		(name.trim() == "Language" && !value.is_empty()).then_some(value)
	})
}

/// Returns the module for the catalog in `text`.
fn compile(text: &str, hash_length: Option<usize>) -> Result<String, String> {
	let catalog = po::parse(text)?;
	let language = language(catalog.header.as_ref()).ok_or("Language header is missing")?;
	let mut keys = KeyBuilder::new(hash_length);
	let mut messages = vec![];
	// obsolete entries are not used by the code
	for entry in catalog.entries.iter().filter(|entry| !entry.obsolete) {
		let key = keys
			.build(&entry.msgid)
			.map_err(|error| format!("{error}: \"{}\"", entry.msgid))?;
		let message = entry
			.msgstr
			.first()
			.filter(|msgstr| !msgstr.is_empty())
			.unwrap_or(&entry.msgid);
		let value = convert(message).map_err(|error| format!("Invalid message \"{message}\": {error}"))?;
		messages.push((key, value));
	}
	let mut out = "export default ".to_string();
	write_json(
		&Value::Arr(vec![Value::Str(language.into()), Value::Obj(messages)]),
		&mut out,
	);
	Ok(out)
}

/// Returns the relative path from `from` to `to`, both must be absolute and normalized.
fn relative(from: &Path, to: &Path) -> PathBuf {
	let from: Vec<_> = from.components().collect();
	let to: Vec<_> = to.components().collect();
	let common = from.iter().zip(&to).take_while(|(a, b)| a == b).count();
	let mut result: PathBuf = from[common..].iter().map(|_| Component::ParentDir).collect();
	result.extend(&to[common..]);
	result
}

/// Compiles the catalog of each configured locale into `<out_dir>/<catalog path relative to the sources>.po.js`.
pub fn build(cwd: &Path, config: &Config, out_dir: &str) -> Result<(), String> {
	let out_dir = resolve(cwd, out_dir);
	for locale in &config.locales {
		let catalog = PathBuf::from(config.catalog_path.replace("{locale}", locale));
		let source = format!("{}.po", catalog.display());
		let text = fs::read_to_string(&source).map_err(|error| format!("Error reading {source}: {error}"))?;
		let code = compile(&text, config.hash_length).map_err(|error| format!("Error compiling {source}: {error}"))?;

		let target = resolve(&out_dir, &relative(&config.source_path, &catalog).to_string_lossy());
		let target = format!("{}.po.js", target.display());
		if let Some(dir) = Path::new(&target).parent() {
			fs::create_dir_all(dir).map_err(|error| format!("Error creating {}: {error}", dir.display()))?;
		}
		fs::write(&target, code).map_err(|error| format!("Error saving {target}: {error}"))?;
	}
	Ok(())
}

#[cfg(test)]
mod tests {
	use super::*;

	fn json(message: &str) -> String {
		let mut out = String::new();
		write_json(&convert(message).unwrap(), &mut out);
		out
	}

	#[test]
	fn converts_literals() {
		assert_eq!(json(""), r#""""#);
		assert_eq!(json("Hello"), r#""Hello""#);
		assert_eq!(json("Don't do it, it's fine"), r#""Don't do it, it's fine""#);
		assert_eq!(json("'{'{name}'}' ''"), r#"["{",[1,"name"],"} '"]"#);
		assert_eq!(json("<b>bold</b> \"quoted\"\n"), r#""<b>bold</b> \"quoted\"\n""#);
	}

	#[test]
	fn converts_arguments_and_functions() {
		assert_eq!(json("{ name }"), r#"[[1,"name"]]"#);
		assert_eq!(json("{0} of {count}"), r#"[[1,"0"]," of ",[1,"count"]]"#);
		assert_eq!(json("{n, number}"), r#"[[6,"n"]]"#);
		assert_eq!(json("{n, number,  percent }"), r#"[[6,"n","percent"]]"#);
		assert_eq!(json("{d, date, short} {d, time}"), r#"[[7,"d","short"]," ",[8,"d"]]"#);
	}

	#[test]
	fn converts_select_and_plural() {
		assert_eq!(
			json("{k, select, b {B} a {{n}} other {}}"),
			r#"[[2,"k",{"b":"B","a":[[1,"n"]],"other":""}]]"#
		);
		assert_eq!(
			json("{n, plural, offset:1 one {# item} =10 {ten} =0 {none} other {{k, select, a {# a} other {x}}}}"),
			r##"[[3,"n",{"0":"none","10":"ten","offset":1,"one":[[5]," item"],"other":[[2,"k",{"a":"# a","other":"x"}]]}]]"##
		);
		assert_eq!(
			json("{n, selectordinal, one {#st} other {#th}}"),
			r#"[[4,"n",{"one":[[5],"st"],"other":[[5],"th"]}]]"#
		);
		assert_eq!(
			json("{n, plural, other {'#' is #}}"),
			r##"[[3,"n",{"other":["# is ",[5]]}]]"##
		);
	}

	#[test]
	fn writes_repeated_keys_once_in_their_first_position() {
		let value = Value::Obj(vec![
			("b".into(), Value::Num(1.0)),
			("2".into(), Value::Num(2.0)),
			("a".into(), Value::Num(3.0)),
			("b".into(), Value::Num(4.0)),
			("1".into(), Value::Num(5.0)),
		]);
		let mut out = String::new();
		write_json(&value, &mut out);
		assert_eq!(out, r#"{"1":5,"2":2,"b":4,"a":3}"#);
	}

	#[test]
	fn reports_invalid_messages() {
		assert_eq!(convert("{x, spellout}"), Err("invalid argument type at 1:5".into()));
		assert_eq!(
			convert("{unclosed"),
			Err("expect argument closing brace at 1:10".into())
		);
		assert_eq!(
			convert("{n, plural, lots {x} other {y}}"),
			Err("the plural case lots is not valid".into())
		);
		assert_eq!(
			convert("{n, number, ::currency/USD}"),
			Err("number skeletons are not supported".into())
		);
		assert_eq!(
			convert("{d, date, ::yyyyMMdd}"),
			Err("date and time skeletons are not supported".into())
		);
	}

	#[test]
	fn lists_index_keys_first() {
		let mut out = String::new();
		let object = Value::Obj(
			["b", "10", "a", "2", "01", "4294967295", "2"]
				.iter()
				.enumerate()
				.map(|(i, key)| (key.to_string(), Value::Num(i as f64)))
				.collect(),
		);
		write_json(&object, &mut out);
		assert_eq!(out, r#"{"2":6,"10":1,"b":0,"a":2,"01":4,"4294967295":5}"#);
	}

	#[test]
	fn compiles_catalogs() {
		let text = "msgid \"\"\nmsgstr \"\"\n\"Language: fr\\n\"\n\n#: 1\nmsgid \"Hello {name}\"\nmsgstr \"Bonjour {name}\"\n\nmsgid \"Bye\"\nmsgstr \"\"\n\n#~ msgid \"Old\"\n#~ msgstr \"Vieux\"\n";
		assert_eq!(
			compile(text, None),
			Ok(r#"export default ["fr",{"Hello {name}":["Bonjour ",[1,"name"]],"Bye":"Bye"}]"#.into())
		);
		assert_eq!(
			compile(text, Some(4)),
			Ok(r#"export default ["fr",{"11e1":["Bonjour ",[1,"name"]],"f792":"Bye"}]"#.into())
		);
	}

	#[test]
	fn reports_invalid_catalogs() {
		assert_eq!(
			compile("msgid \"a\"\nmsgstr \"\"\n", None),
			Err("Language header is missing".into())
		);
		assert_eq!(
			compile(
				"msgid \"\"\nmsgstr \"Language: en\\n\"\n\nmsgid \"{a\"\nmsgstr \"\"\n",
				None
			),
			Err("Invalid message \"{a\": expect argument closing brace at 1:3".into())
		);
	}

	#[test]
	fn computes_relative_paths() {
		assert_eq!(
			relative(Path::new("/a/src"), Path::new("/a/src/l10n/en")),
			PathBuf::from("l10n/en")
		);
		assert_eq!(
			relative(Path::new("/a/src"), Path::new("/a/l10n/en")),
			PathBuf::from("../l10n/en")
		);
	}

	#[test]
	fn builds_all_locales() {
		let tmp = tempfile::tempdir().unwrap();
		let root = tmp.path();
		fs::create_dir_all(root.join("src/l10n")).unwrap();
		for locale in ["en", "fr"] {
			let text = format!("msgid \"\"\nmsgstr \"Language: {locale}\\n\"\n\nmsgid \"Hi\"\nmsgstr \"\"\n");
			fs::write(root.join(format!("src/l10n/{locale}.po")), text).unwrap();
		}
		let config = Config {
			source_path: root.join("src"),
			catalog_path: root.join("src/l10n/{locale}").to_string_lossy().into_owned(),
			locales: vec!["en".into(), "fr".into()],
			hash_length: None,
		};
		build(root, &config, "dist").unwrap();
		assert_eq!(
			fs::read_to_string(root.join("dist/l10n/fr.po.js")).unwrap(),
			r#"export default ["fr",{"Hi":"Hi"}]"#
		);
		assert!(root.join("dist/l10n/en.po.js").exists());

		let error = build(
			root,
			&Config {
				locales: vec!["de".into()],
				..config
			},
			"dist",
		)
		.unwrap_err();
		assert!(
			error.starts_with("Error reading ") && error.contains("de.po"),
			"{error}"
		);
	}
}

//! Updates the PO catalogs with the extracted strings.

use std::{
	cmp::Ordering,
	collections::{BTreeMap, HashSet},
	fs, io,
	path::Path,
	time::SystemTime,
};

use icu_collator::{
	options::{CollatorOptions, Strength},
	Collator, CollatorBorrowed,
};
use icu_locale_core::locale;

use crate::po::{self, Entry, PoFile};

/// Sorts the messages like `Intl.Collator('en')`, which orders them by their base letters first and then uses
/// accents and case to break ties.
pub fn collator() -> CollatorBorrowed<'static> {
	let mut options = CollatorOptions::default();
	options.strength = Some(Strength::Tertiary);
	Collator::try_new(locale!("en").into(), options).expect("collation data is compiled in")
}

fn compare(collator: &CollatorBorrowed, a: &str, b: &str) -> Ordering {
	// strings which only differ in their normalization form are sorted by code point so the order is stable
	collator.compare(a, b).then_with(|| a.cmp(b))
}

/// Formats a time as an ISO 8601 date in UTC, like `Date.prototype.toISOString`.
fn iso_date(time: SystemTime) -> String {
	humantime::format_rfc3339_millis(time).to_string()
}

fn new_catalog(locale: &str) -> PoFile {
	let header = [
		("POT-Creation-Date", iso_date(SystemTime::now())),
		("Mime-Version", "1.0".into()),
		("Content-Type", "text/plain; charset=utf-8".into()),
		("Content-Transfer-Encoding", "8bit".into()),
		("X-Generator", "@bluecateng/l10n-cli".into()),
		("Language", locale.into()),
	]
	.iter()
	.map(|(name, value)| format!("{name}: {value}\n"))
	.collect();
	PoFile {
		header: Some(Entry {
			msgstr: vec![header],
			..Entry::new(String::new())
		}),
		entries: vec![],
	}
}

pub struct Options {
	/// Remove the obsolete entries.
	pub clean: bool,
	/// Mark the entries which are not in the extracted strings as obsolete.
	pub mark_obsolete: bool,
}

/// Updates the catalog for `locale`, `strings` maps each message to its key when the keys are hashed.
pub fn update(
	catalog_path: &str,
	locale: &str,
	strings: &BTreeMap<String, Option<String>>,
	options: &Options,
	collator: &CollatorBorrowed,
) -> Result<(), String> {
	let path = format!("{}.po", catalog_path.replace("{locale}", locale));
	let mut catalog = match fs::read_to_string(&path) {
		Ok(text) => po::parse(&text).map_err(|error| format!("Error parsing {path}: {error}"))?,
		Err(error) if error.kind() == io::ErrorKind::NotFound => new_catalog(locale),
		Err(error) => return Err(format!("Error reading {path}: {error}")),
	};

	let mut changed = false;
	let mut found = HashSet::new();
	for entry in &mut catalog.entries {
		if strings.contains_key(&entry.msgid) {
			found.insert(entry.msgid.clone());
			if entry.obsolete {
				entry.obsolete = false;
				changed = true;
			}
		} else if options.mark_obsolete && !entry.obsolete {
			entry.obsolete = true;
			changed = true;
		}
	}
	if options.clean && catalog.entries.iter().any(|entry| entry.obsolete) {
		catalog.entries.retain(|entry| !entry.obsolete);
		changed = true;
	}
	for (msgid, key) in strings {
		if !found.contains(msgid) {
			let mut entry = Entry::new(msgid.clone());
			entry.references.extend(key.clone());
			catalog.entries.push(entry);
			changed = true;
		}
	}

	if changed {
		catalog.entries.sort_by(|a, b| compare(collator, &a.msgid, &b.msgid));
		if let Some(dir) = Path::new(&path).parent() {
			fs::create_dir_all(dir).map_err(|error| format!("Error creating {}: {error}", dir.display()))?;
		}
		// written to a temporary file first so the catalog is never left half written
		let tmp = format!("{path}.tmp");
		fs::write(&tmp, catalog.to_string())
			.and_then(|()| fs::rename(&tmp, &path))
			.map_err(|error| format!("Error saving {path}: {error}"))?;
	}
	Ok(())
}

#[cfg(test)]
mod tests {
	use std::time::UNIX_EPOCH;

	use super::*;

	fn strings(list: &[(&str, Option<&str>)]) -> BTreeMap<String, Option<String>> {
		list.iter()
			.map(|(msgid, key)| (msgid.to_string(), key.map(String::from)))
			.collect()
	}

	fn options(clean: bool, mark_obsolete: bool) -> Options {
		Options { clean, mark_obsolete }
	}

	fn read(path: &Path) -> PoFile {
		po::parse(&fs::read_to_string(path).unwrap()).unwrap()
	}

	fn summary(file: &PoFile) -> Vec<(String, bool, Vec<String>)> {
		file.entries
			.iter()
			.map(|e| (e.msgid.clone(), e.obsolete, e.references.clone()))
			.collect()
	}

	#[test]
	fn formats_iso_dates() {
		assert_eq!(iso_date(UNIX_EPOCH), "1970-01-01T00:00:00.000Z");
		let time = UNIX_EPOCH + std::time::Duration::from_millis(1_622_673_973_739);
		assert_eq!(iso_date(time), "2021-06-02T22:46:13.739Z");
		let time = UNIX_EPOCH + std::time::Duration::from_millis(951_782_400_000);
		assert_eq!(iso_date(time), "2000-02-29T00:00:00.000Z");
	}

	#[test]
	fn sorts_like_intl_collator() {
		let collator = collator();
		let mut list = vec![
			"b", "B", "a", "é", "e", "{name}", "_x", "1", "Z", "From {0}", "from {0}", "e\u{301}",
		];
		list.sort_by(|a, b| compare(&collator, a, b));
		assert_eq!(
			list,
			vec!["_x", "{name}", "1", "a", "b", "B", "e", "e\u{301}", "é", "from {0}", "From {0}", "Z"]
		);
	}

	#[test]
	fn creates_a_new_catalog() {
		let tmp = tempfile::tempdir().unwrap();
		let catalog_path = tmp.path().join("l10n/{locale}").to_string_lossy().into_owned();
		let strings = strings(&[("Hello", Some("f7ff")), ("bye", Some("78e7"))]);
		update(&catalog_path, "fr", &strings, &options(false, true), &collator()).unwrap();

		let file = read(&tmp.path().join("l10n/fr.po"));
		let header = &file.header.as_ref().unwrap().msgstr[0];
		assert!(header.starts_with("POT-Creation-Date: "), "{header}");
		assert!(
			header.ends_with("X-Generator: @bluecateng/l10n-cli\nLanguage: fr\n"),
			"{header}"
		);
		assert_eq!(
			summary(&file),
			vec![
				("bye".into(), false, vec!["78e7".into()]),
				("Hello".into(), false, vec!["f7ff".into()])
			]
		);
		assert!(!tmp.path().join("l10n/fr.po.tmp").exists());
	}

	#[test]
	fn updates_an_existing_catalog() {
		let tmp = tempfile::tempdir().unwrap();
		let path = tmp.path().join("en.po");
		let catalog_path = tmp.path().join("{locale}").to_string_lossy().into_owned();
		fs::write(
			&path,
			"msgid \"\"\nmsgstr \"Language: en\\n\"\n\n#: k1\nmsgid \"kept\"\nmsgstr \"Kept\"\n\nmsgid \"removed\"\nmsgstr \"\"\n\n#~ msgid \"revived\"\n#~ msgstr \"Revived\"\n",
		)
		.unwrap();
		let strings = strings(&[("kept", None), ("revived", None), ("added", None)]);

		update(&catalog_path, "en", &strings, &options(false, false), &collator()).unwrap();
		let file = read(&path);
		assert_eq!(
			summary(&file),
			vec![
				("added".into(), false, vec![]),
				("kept".into(), false, vec!["k1".into()]),
				("removed".into(), false, vec![]),
				("revived".into(), false, vec![]),
			]
		);
		assert_eq!(file.entries[1].msgstr, vec!["Kept"]);
		assert_eq!(file.entries[3].msgstr, vec!["Revived"]);

		update(&catalog_path, "en", &strings, &options(false, true), &collator()).unwrap();
		assert_eq!(read(&path).entries[2], {
			let mut entry = Entry::new("removed".into());
			entry.obsolete = true;
			entry
		});

		update(&catalog_path, "en", &strings, &options(true, false), &collator()).unwrap();
		let msgids: Vec<_> = read(&path).entries.into_iter().map(|e| e.msgid).collect();
		assert_eq!(msgids, vec!["added", "kept", "revived"]);
	}

	#[test]
	fn does_not_write_unchanged_catalogs() {
		let tmp = tempfile::tempdir().unwrap();
		let path = tmp.path().join("en.po");
		let catalog_path = tmp.path().join("{locale}").to_string_lossy().into_owned();
		// not in the format the catalog would be written in
		let text = "msgid \"\"\nmsgstr \"\"\n\"Language: en\\n\"\n\nmsgid \"a\"\nmsgstr \"\"\n\n#~ msgid \"b\"\n#~ msgstr \"\"\n\n\n";
		fs::write(&path, text).unwrap();
		update(
			&catalog_path,
			"en",
			&strings(&[("a", None)]),
			&options(false, true),
			&collator(),
		)
		.unwrap();
		assert_eq!(fs::read_to_string(&path).unwrap(), text);
	}

	#[test]
	fn reports_invalid_catalogs() {
		let tmp = tempfile::tempdir().unwrap();
		fs::write(tmp.path().join("en.po"), "msgid x\n").unwrap();
		let catalog_path = tmp.path().join("{locale}").to_string_lossy().into_owned();
		let error = update(&catalog_path, "en", &strings(&[]), &options(false, false), &collator()).unwrap_err();
		assert!(
			error.starts_with("Error parsing ") && error.ends_with(": Invalid string on line 1"),
			"{error}"
		);
	}
}

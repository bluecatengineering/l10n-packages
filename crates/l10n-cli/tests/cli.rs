use std::{fs, path::Path, process::Command};

fn run(dir: &Path, args: &[&str]) -> (bool, String) {
	let output = Command::new(env!("CARGO_BIN_EXE_l10n-cli"))
		.args(args)
		.current_dir(dir)
		.output()
		.unwrap();
	(output.status.success(), String::from_utf8(output.stderr).unwrap())
}

fn project() -> tempfile::TempDir {
	let tmp = tempfile::tempdir().unwrap();
	let root = tmp.path();
	fs::write(
		root.join("package.json"),
		r#"{"name": "test", "bc-l10n": {"module": "src/l10n", "catalogPath": "src/l10n/{locale}", "locales": ["en", "fr"], "hashLength": 4}}"#,
	)
	.unwrap();
	fs::create_dir_all(root.join("src/l10n")).unwrap();
	fs::write(
		root.join("src/a.js"),
		"import {t} from '@bluecateng/l10n.macro';\nexport const a = t`Hello`;\n",
	)
	.unwrap();
	fs::write(
		root.join("src/b.tsx"),
		"import {t} from '@bluecateng/l10n.macro';\nexport const B = (p: {n: number}) => <b>{t`Bye`}</b>;\n",
	)
	.unwrap();
	tmp
}

#[test]
fn extracts_strings_into_all_catalogs() {
	let tmp = project();
	let root = tmp.path();
	assert_eq!(run(root, &[]), (true, String::new()));

	let en = fs::read_to_string(root.join("src/l10n/en.po")).unwrap();
	assert!(en.contains("\"Language: en\\n\""), "{en}");
	assert!(
		en.ends_with("\n\n#: f792\nmsgid \"Bye\"\nmsgstr \"\"\n\n#: f7ff\nmsgid \"Hello\"\nmsgstr \"\"\n"),
		"{en}"
	);
	assert!(fs::read_to_string(root.join("src/l10n/fr.po"))
		.unwrap()
		.contains("\"Language: fr\\n\""));

	// removed strings are marked as obsolete, and deleted with --clean
	fs::write(root.join("src/b.tsx"), "export {};\n").unwrap();
	assert!(run(root, &[]).0);
	let en = fs::read_to_string(root.join("src/l10n/en.po")).unwrap();
	assert!(en.contains("#: f792\n#~ msgid \"Bye\"\n#~ msgstr \"\"\n"), "{en}");
	assert!(run(root, &["--clean"]).0);
	assert!(!fs::read_to_string(root.join("src/l10n/en.po")).unwrap().contains("Bye"));
}

#[test]
fn updates_only_the_selected_locale_from_the_given_sources() {
	let tmp = project();
	let root = tmp.path();
	assert!(run(&root.join("src"), &["-l", "fr", "a.js", "../other.js"]).0);
	let fr = fs::read_to_string(root.join("src/l10n/fr.po")).unwrap();
	assert!(fr.contains("msgid \"Hello\"") && !fr.contains("Bye"), "{fr}");
	assert!(!root.join("src/l10n/en.po").exists());
}

#[test]
fn reports_errors_without_updating_the_catalogs() {
	let tmp = project();
	let root = tmp.path();
	fs::write(
		root.join("src/c.js"),
		"import {t} from '@bluecateng/l10n.macro';\nt();\n",
	)
	.unwrap();
	let (success, stderr) = run(root, &[]);
	assert!(!success);
	assert!(
		stderr.ends_with("src/c.js:2:1: This macro requires one argument\n"),
		"{stderr}"
	);
	assert!(!root.join("src/l10n/en.po").exists());
}

#[test]
fn reports_missing_configuration() {
	let tmp = tempfile::tempdir().unwrap();
	fs::write(tmp.path().join("package.json"), "{}").unwrap();
	let (success, stderr) = run(tmp.path(), &[]);
	assert!(!success);
	assert_eq!(
		stderr,
		"L10n configuration is missing, add \"bc-l10n\" object to package.json\n"
	);
}

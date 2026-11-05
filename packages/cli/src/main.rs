//! Command line utilities for l10n.
//!
//! Usage:
//! - `l10n-cli [-c|--clean] [-l|--locale <locale>] [sources...]` extracts the strings and updates the catalogs.
//! - `l10n-cli build <outDir>` compiles the catalogs.
//! - `l10n-cli -h|--help` prints the usage.

use std::{collections::BTreeMap, env, path::Path, process::ExitCode};

use l10n_macro::KeyBuilder;

mod catalog;
mod compile;
mod config;
mod extract;
mod po;

const HELP: &str = "\
Command line utilities for l10n

Usage:
  l10n-cli [-c|--clean] [-l|--locale <locale>] [<file-paths>...]
  l10n-cli build <outDir>

Commands:
  [<file-paths>...]     Extract localizable strings and update the catalogs (default)
  build <outDir>        Compile the catalogs into .po.js modules in <outDir>

Options:
  -c, --clean           Remove the obsolete entries from the catalogs
  -l, --locale <locale> Update only the given locale
  -h, --help            Print this help
";

#[derive(Debug, PartialEq)]
enum Command {
	Help,
	Extract {
		clean: bool,
		locale: Option<String>,
		sources: Vec<String>,
	},
	Build {
		out_dir: String,
	},
}

fn parse_args(args: &[String]) -> Result<Command, String> {
	let mut clean = false;
	let mut locale = None;
	let mut index = 0;
	loop {
		match args.get(index).map(String::as_str) {
			Some("-h" | "--help") => return Ok(Command::Help),
			Some("-c" | "--clean") => {
				clean = true;
				index += 1;
			}
			Some("-l" | "--locale") => {
				let value = args.get(index + 1).ok_or("The locale option requires a value")?;
				locale = Some(value.clone());
				index += 2;
			}
			_ => break,
		}
	}
	if args.get(index).map(String::as_str) == Some("build") {
		if matches!(args.get(index + 1).map(String::as_str), Some("-h" | "--help")) {
			return Ok(Command::Help);
		}
		let out_dir = args
			.get(index + 1)
			.ok_or("The build command requires the output directory")?;
		return Ok(Command::Build {
			out_dir: out_dir.clone(),
		});
	}
	Ok(Command::Extract {
		clean,
		locale,
		sources: args[index..].to_vec(),
	})
}

fn extract(cwd: &Path, clean: bool, locale: Option<&str>, sources: &[String]) -> Result<(), String> {
	let config = config::load(cwd)?;
	let files = extract::find_files(&config.source_path, cwd, sources)?;
	let strings = extract::extract_files(&files).map_err(|errors| errors.join("\n"))?;

	let mut keys = KeyBuilder::new(config.hash_length);
	let strings = strings
		.into_iter()
		.map(|string| {
			let key = match keys.build(&string) {
				Ok(key) => keys.is_hashed().then_some(key),
				Err(error) => return Err(format!("{error}: \"{string}\"")),
			};
			Ok((string, key))
		})
		.collect::<Result<BTreeMap<_, _>, _>>()?;

	let collator = catalog::collator();
	match locale {
		Some(locale) => catalog::update(
			&config.catalog_path,
			locale,
			&strings,
			&catalog::Options {
				clean,
				mark_obsolete: false,
			},
			&collator,
		),
		None => config.locales.iter().try_for_each(|locale| {
			catalog::update(
				&config.catalog_path,
				locale,
				&strings,
				&catalog::Options {
					clean,
					// with explicit sources only some of the strings are known, so the others are not obsolete
					mark_obsolete: sources.is_empty(),
				},
				&collator,
			)
		}),
	}
}

fn run(args: &[String]) -> Result<(), String> {
	let command = parse_args(args)?;
	if command == Command::Help {
		print!("{HELP}");
		return Ok(());
	}
	let cwd = env::current_dir().map_err(|error| format!("Error reading the current directory: {error}"))?;
	match command {
		Command::Help => Ok(()),
		Command::Extract { clean, locale, sources } => extract(&cwd, clean, locale.as_deref(), &sources),
		Command::Build { out_dir } => compile::build(&cwd, &config::load(&cwd)?, &out_dir),
	}
}

fn main() -> ExitCode {
	let args: Vec<String> = env::args().skip(1).collect();
	match run(&args) {
		Ok(()) => ExitCode::SUCCESS,
		Err(error) => {
			eprintln!("{error}");
			ExitCode::FAILURE
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	fn args(list: &[&str]) -> Vec<String> {
		list.iter().map(|arg| arg.to_string()).collect()
	}

	#[test]
	fn parses_extract() {
		assert_eq!(
			parse_args(&args(&[])),
			Ok(Command::Extract {
				clean: false,
				locale: None,
				sources: vec![]
			})
		);
		assert_eq!(
			parse_args(&args(&["-c", "--locale", "fr", "a.js", "-c"])),
			Ok(Command::Extract {
				clean: true,
				locale: Some("fr".into()),
				sources: args(&["a.js", "-c"])
			})
		);
		assert_eq!(
			parse_args(&args(&["--clean", "-l"])),
			Err("The locale option requires a value".into())
		);
	}

	#[test]
	fn parses_help() {
		assert_eq!(parse_args(&args(&["-h"])), Ok(Command::Help));
		assert_eq!(parse_args(&args(&["-c", "--help", "-l"])), Ok(Command::Help));
		assert_eq!(parse_args(&args(&["build", "--help"])), Ok(Command::Help));
		// after the sources it is a file path
		assert!(matches!(
			parse_args(&args(&["a.js", "-h"])),
			Ok(Command::Extract { .. })
		));
	}

	#[test]
	fn parses_build() {
		assert_eq!(
			parse_args(&args(&["build", "dist"])),
			Ok(Command::Build { out_dir: "dist".into() })
		);
		assert_eq!(
			parse_args(&args(&["build"])),
			Err("The build command requires the output directory".into())
		);
	}
}

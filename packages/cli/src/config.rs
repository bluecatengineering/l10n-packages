//! Loads the "bc-l10n" configuration from the closest package.json which contains it.

use std::{
	fs,
	path::{Component, Path, PathBuf},
};

use serde::Deserialize;

#[derive(Debug, PartialEq)]
pub struct Config {
	/// Directory scanned for source files.
	pub source_path: PathBuf,
	/// Path of the catalogs without the extension, contains a "{locale}" token.
	pub catalog_path: String,
	pub locales: Vec<String>,
	pub hash_length: Option<usize>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawConfig {
	module: Option<String>,
	catalog_path: Option<String>,
	source_path: Option<String>,
	locales: Option<Vec<String>>,
	hash_length: Option<usize>,
}

#[derive(Deserialize)]
struct PackageJson {
	#[serde(rename = "bc-l10n")]
	config: Option<RawConfig>,
}

/// Joins `path` to `base` and removes "." and ".." components, like `path.posix.join` in node.
pub fn resolve(base: &Path, path: &str) -> PathBuf {
	let mut result = PathBuf::new();
	for component in base.join(path).components() {
		match component {
			Component::CurDir => {}
			Component::ParentDir => {
				result.pop();
			}
			_ => result.push(component),
		}
	}
	result
}

fn validate(raw: RawConfig, root: &Path) -> Result<Config, String> {
	if raw.module.is_none() {
		return Err("The \"module\" configuration is missing".into());
	}
	let Some(catalog_path) = raw.catalog_path else {
		return Err("The \"catalogPath\" configuration is missing".into());
	};
	if !catalog_path.contains("{locale}") {
		return Err("The \"catalogPath\" must contain a \"{locale}\" token".into());
	}
	Ok(Config {
		source_path: resolve(root, raw.source_path.as_deref().unwrap_or("src")),
		catalog_path: resolve(root, &catalog_path).to_string_lossy().into_owned(),
		locales: raw.locales.unwrap_or_else(|| vec!["en".into()]),
		hash_length: raw.hash_length,
	})
}

/// Searches `dir` and its ancestors for a package.json with a "bc-l10n" property.
pub fn load(dir: &Path) -> Result<Config, String> {
	for dir in dir.ancestors() {
		let path = dir.join("package.json");
		let text = match fs::read_to_string(&path) {
			Ok(text) => text,
			Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
			Err(error) => return Err(format!("Error reading {}: {error}", path.display())),
		};
		let package: PackageJson =
			serde_json::from_str(&text).map_err(|error| format!("Error parsing {}: {error}", path.display()))?;
		if let Some(raw) = package.config {
			return validate(raw, dir);
		}
	}
	Err("L10n configuration is missing, add \"bc-l10n\" object to package.json".into())
}

#[cfg(test)]
mod tests {
	use super::*;

	fn write_package(dir: &Path, json: &str) {
		fs::create_dir_all(dir).unwrap();
		fs::write(dir.join("package.json"), json).unwrap();
	}

	#[test]
	fn resolves_paths() {
		assert_eq!(resolve(Path::new("/a/b"), "c"), PathBuf::from("/a/b/c"));
		assert_eq!(resolve(Path::new("/a/b"), "./c/../d"), PathBuf::from("/a/b/d"));
		assert_eq!(resolve(Path::new("/a/b"), "../c"), PathBuf::from("/a/c"));
		assert_eq!(resolve(Path::new("/a/b"), "/x/./y"), PathBuf::from("/x/y"));
	}

	#[test]
	fn loads_closest_package_with_config() {
		let tmp = tempfile::tempdir().unwrap();
		let root = tmp.path();
		write_package(
			root,
			r#"{"bc-l10n": {"module": "src/l10n", "catalogPath": "l10n/{locale}", "hashLength": 4, "locales": ["en", "fr"]}}"#,
		);
		// packages without the configuration are skipped
		write_package(&root.join("sub"), r#"{"name": "sub"}"#);
		let nested = root.join("sub/dir");
		fs::create_dir_all(&nested).unwrap();

		assert_eq!(
			load(&nested),
			Ok(Config {
				source_path: root.join("src"),
				catalog_path: root.join("l10n/{locale}").to_string_lossy().into_owned(),
				locales: vec!["en".into(), "fr".into()],
				hash_length: Some(4),
			})
		);
	}

	#[test]
	fn applies_defaults_and_custom_source_path() {
		let tmp = tempfile::tempdir().unwrap();
		write_package(
			tmp.path(),
			r#"{"bc-l10n": {"module": "m", "catalogPath": "/abs/{locale}", "sourcePath": "lib"}}"#,
		);
		let config = load(tmp.path()).unwrap();
		assert_eq!(config.source_path, tmp.path().join("lib"));
		assert_eq!(config.catalog_path, "/abs/{locale}");
		assert_eq!(config.locales, vec!["en".to_string()]);
		assert_eq!(config.hash_length, None);
	}

	#[test]
	fn validates_config() {
		let tmp = tempfile::tempdir().unwrap();
		let cases = [
			(
				r#"{"bc-l10n": {"catalogPath": "{locale}"}}"#,
				"The \"module\" configuration is missing",
			),
			(
				r#"{"bc-l10n": {"module": "m"}}"#,
				"The \"catalogPath\" configuration is missing",
			),
			(
				r#"{"bc-l10n": {"module": "m", "catalogPath": "l10n"}}"#,
				"The \"catalogPath\" must contain a \"{locale}\" token",
			),
		];
		for (json, message) in cases {
			write_package(tmp.path(), json);
			assert_eq!(load(tmp.path()), Err(message.to_string()));
		}
	}

	#[test]
	fn fails_without_config() {
		let tmp = tempfile::tempdir().unwrap();
		assert_eq!(
			load(tmp.path()),
			Err("L10n configuration is missing, add \"bc-l10n\" object to package.json".to_string())
		);
	}

	#[test]
	fn fails_with_invalid_package() {
		let tmp = tempfile::tempdir().unwrap();
		write_package(tmp.path(), "{");
		assert!(load(tmp.path()).unwrap_err().starts_with("Error parsing "));
	}
}

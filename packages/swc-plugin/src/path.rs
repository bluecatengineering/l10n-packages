//! Minimal POSIX path handling, the plugin runs in a WASI sandbox so the paths can not be resolved using the file
//! system.

fn components<'a>(cwd: &'a str, path: &'a str) -> Vec<&'a str> {
	let full = if path.starts_with('/') { [path, ""] } else { [cwd, path] };
	let mut result = vec![];
	for component in full.iter().flat_map(|part| part.split('/')) {
		match component {
			"" | "." => {}
			".." => {
				result.pop();
			}
			_ => result.push(component),
		}
	}
	result
}

/// Returns the specifier to import `module` from `filename`, relative paths are resolved from `cwd`.
pub fn import_source(cwd: &str, filename: &str, module: &str) -> String {
	let mut dir = components(cwd, filename);
	dir.pop();
	let module = components(cwd, module);
	let common = dir.iter().zip(&module).take_while(|(a, b)| a == b).count();
	let relative = std::iter::repeat_n("..", dir.len() - common)
		.chain(module[common..].iter().copied())
		.collect::<Vec<_>>()
		.join("/");
	if relative.starts_with("../") || relative == ".." {
		relative
	} else {
		format!("./{relative}")
	}
}

#[cfg(test)]
mod tests {
	use super::import_source;

	#[test]
	fn same_directory() {
		assert_eq!(import_source("/", "/foo/baz.js", "/foo/bar"), "./bar");
	}

	#[test]
	fn parent_directory() {
		assert_eq!(import_source("/", "/foo/blah/waa.js", "/foo/bar"), "../bar");
	}

	#[test]
	fn child_directory() {
		assert_eq!(import_source("/", "/foo/main.js", "/foo/src/l10n"), "./src/l10n");
	}

	#[test]
	fn module_is_ancestor() {
		assert_eq!(import_source("/", "/foo/l10n/x/y.js", "/foo/l10n"), "..");
	}

	#[test]
	fn module_is_directory() {
		assert_eq!(import_source("/", "/foo/l10n/y.js", "/foo/l10n"), "./");
	}

	#[test]
	fn relative_paths() {
		assert_eq!(import_source("/project", "src/a/b.js", "src/l10n"), "../l10n");
		assert_eq!(
			import_source("/project/", "./src/./b.js", "/project/src/l10n/"),
			"./l10n"
		);
	}

	#[test]
	fn dot_directory() {
		assert_eq!(import_source("/", "/foo/a.js", "/foo/.l10n"), "./.l10n");
	}
}

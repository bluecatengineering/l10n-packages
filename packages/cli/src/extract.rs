//! Finds the source files and extracts the strings used in the l10n macros.

use std::{
	collections::{BTreeSet, HashMap},
	fs,
	path::{Path, PathBuf},
	sync::atomic::{AtomicUsize, Ordering},
	thread,
};

use l10n_macro::{convert_call, convert_template, register_import, Context, Macro, MACRO_MODULE};
use swc_core::{
	common::{sync::Lrc, FileName, Globals, Mark, SourceMap, Span, Spanned, GLOBALS},
	ecma::{
		ast::*,
		parser::{parse_file_as_module, Syntax, TsSyntax},
		transforms::base::resolver,
		visit::{Visit, VisitMutWith, VisitWith},
	},
};
use walkdir::WalkDir;

use crate::config::resolve;

fn is_source(path: &Path) -> bool {
	matches!(
		path.extension().and_then(|ext| ext.to_str()),
		Some("js" | "jsx" | "ts" | "tsx")
	)
}

/// Returns the source files in `source_path`, or the ones in `sources` which are inside `source_path`.
pub fn find_files(source_path: &Path, cwd: &Path, sources: &[String]) -> Result<Vec<PathBuf>, String> {
	if !sources.is_empty() {
		return Ok(sources
			.iter()
			.map(|source| resolve(cwd, source))
			.filter(|path| path.starts_with(source_path) && is_source(path))
			.collect());
	}
	let mut files = vec![];
	for entry in WalkDir::new(source_path) {
		let entry = entry.map_err(|error| format!("Error scanning {}: {error}", source_path.display()))?;
		// symbolic links are not followed, as in the previous version
		if entry.file_type().is_file() && is_source(entry.path()) {
			files.push(entry.into_path());
		}
	}
	Ok(files)
}

struct Extractor<'a> {
	macros: &'a HashMap<Id, Macro>,
	strings: Vec<String>,
	errors: Vec<(Span, String)>,
}

impl Extractor<'_> {
	fn macro_for(&self, expr: &Expr) -> Option<Macro> {
		match expr {
			Expr::Ident(ident) => self.macros.get(&ident.to_id()).copied(),
			_ => None,
		}
	}

	fn add(&mut self, convert: impl FnOnce(&mut Context) -> l10n_macro::Result<String>) {
		let mut ctx = Context::new(self.macros);
		match convert(&mut ctx) {
			Ok(string) => {
				self.strings.push(string);
				// numeric arguments can contain other macro calls
				for arg in &ctx.num_args {
					arg.visit_with(self);
				}
			}
			Err(error) => self.errors.push((error.span, error.message)),
		}
	}
}

impl Visit for Extractor<'_> {
	fn visit_expr(&mut self, expr: &Expr) {
		match expr {
			Expr::TaggedTpl(tagged) => match self.macro_for(&tagged.tag) {
				Some(Macro::T) => self.add(|ctx| convert_template(&tagged.tpl, ctx)),
				Some(_) => self.errors.push((
					tagged.tag.span(),
					"Only the t macro can be used as a template tag".into(),
				)),
				None => expr.visit_children_with(self),
			},
			Expr::Call(call) => match &call.callee {
				Callee::Expr(callee) => match self.macro_for(callee) {
					Some(m) => self.add(|ctx| convert_call(m, call, ctx)),
					None => expr.visit_children_with(self),
				},
				_ => expr.visit_children_with(self),
			},
			Expr::Ident(ident) if self.macros.contains_key(&ident.to_id()) => self
				.errors
				.push((ident.span, "Macros can only be called or used as template tags".into())),
			_ => expr.visit_children_with(self),
		}
	}
}

/// Returns the strings in `text`, or the errors found formatted with their location.
pub fn extract_source(path: &Path, text: String) -> Result<Vec<String>, Vec<String>> {
	if !text.contains(MACRO_MODULE) {
		return Ok(vec![]);
	}
	let cm: Lrc<SourceMap> = Default::default();
	let fm = cm.new_source_file(Lrc::new(FileName::Real(path.into())), text);
	let format_error = |span: Span, message: &str| {
		let loc = cm.lookup_char_pos(span.lo);
		format!("{}:{}:{}: {message}", path.display(), loc.line, loc.col_display + 1)
	};
	// JSX is allowed everywhere except in .ts files, where it conflicts with type assertions
	let syntax = Syntax::Typescript(TsSyntax {
		tsx: path.extension().is_none_or(|ext| ext != "ts"),
		decorators: true,
		..Default::default()
	});
	let mut module = parse_file_as_module(&fm, syntax, EsVersion::latest(), None, &mut vec![])
		.map_err(|error| vec![format_error(error.span(), &error.kind().msg())])?;

	GLOBALS.set(&Globals::new(), || {
		// the resolver marks the identifiers so that local variables which shadow the macros are ignored
		module.visit_mut_with(&mut resolver(Mark::new(), Mark::new(), true));

		let mut macros = HashMap::new();
		let mut errors = vec![];
		for item in &module.body {
			if let ModuleItem::ModuleDecl(ModuleDecl::Import(decl)) = item {
				if &*decl.src.value == MACRO_MODULE {
					errors.extend(
						register_import(decl, &mut macros)
							.into_iter()
							.map(|e| (e.span, e.message)),
					);
				}
			}
		}

		let mut extractor = Extractor {
			macros: &macros,
			strings: vec![],
			errors,
		};
		if !macros.is_empty() {
			module.visit_with(&mut extractor);
		}
		if extractor.errors.is_empty() {
			Ok(extractor.strings)
		} else {
			Err(extractor
				.errors
				.iter()
				.map(|(span, message)| format_error(*span, message))
				.collect())
		}
	})
}

fn extract_file(path: &Path) -> Result<Vec<String>, Vec<String>> {
	let text = fs::read_to_string(path).map_err(|error| vec![format!("Error reading {}: {error}", path.display())])?;
	extract_source(path, text)
}

/// Extracts the strings from all the files using all the available cores, returns all the errors if any file fails.
pub fn extract_files(files: &[PathBuf]) -> Result<BTreeSet<String>, Vec<String>> {
	let next = AtomicUsize::new(0);
	let threads = thread::available_parallelism()
		.map_or(1, |n| n.get())
		.min(files.len().max(1));
	let results: Vec<_> = thread::scope(|scope| {
		let handles: Vec<_> = (0..threads)
			.map(|_| {
				scope.spawn(|| {
					let mut results = vec![];
					loop {
						let index = next.fetch_add(1, Ordering::Relaxed);
						let Some(path) = files.get(index) else {
							break results;
						};
						results.push((index, extract_file(path)));
					}
				})
			})
			.collect();
		handles.into_iter().flat_map(|handle| handle.join().unwrap()).collect()
	});

	let mut strings = BTreeSet::new();
	let mut errors = vec![];
	// sorted so the errors are reported in a stable order
	let mut results = results;
	results.sort_by_key(|(index, _)| *index);
	for (_, result) in results {
		match result {
			Ok(found) => strings.extend(found),
			Err(found) => errors.extend(found),
		}
	}
	if errors.is_empty() {
		Ok(strings)
	} else {
		Err(errors)
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	fn extract(name: &str, code: &str) -> Result<Vec<String>, Vec<String>> {
		extract_source(Path::new(name), code.into())
	}

	#[test]
	fn ignores_files_without_macros() {
		// the text is not even parsed
		assert_eq!(extract("a.js", "this is not javascript"), Ok(vec![]));
		assert_eq!(extract("a.js", "// @bluecateng/l10n.macro\nconst t = 1;"), Ok(vec![]));
	}

	#[test]
	fn extracts_templates_and_calls() {
		let code = r#"
			import {t as tt, plural, select} from '@bluecateng/l10n.macro';
			export const a = tt`Hello ${name}`;
			export const b = (n) => plural(n, {one: 'One item', other: '# items'});
			export const c = <div title={select(kind, {a: tt`A`, other: 'Other'})} />;
			export const d = tt`${foo(tt`Nested`)} done`;
		"#;
		assert_eq!(
			extract("a.jsx", code),
			Ok(vec![
				"Hello {name}".to_string(),
				"{n, plural, one {One item} other {# items}}".to_string(),
				// macros used as numeric arguments are extracted as separate strings, like the swc plugin does
				"{kind, select, a {{0}} other {Other}}".to_string(),
				"A".to_string(),
				"{0} done".to_string(),
				"Nested".to_string(),
			])
		);
	}

	#[test]
	fn ignores_shadowed_macros() {
		let code = r#"
			import {t} from '@bluecateng/l10n.macro';
			const f = (t) => t`Not a macro`;
			export const a = t`Macro`;
		"#;
		assert_eq!(extract("a.js", code), Ok(vec!["Macro".to_string()]));
	}

	#[test]
	fn supports_typescript() {
		let code = r#"
			import {t} from '@bluecateng/l10n.macro';
			const x = <string>value;
			export const a: string = t`Typed`;
		"#;
		assert_eq!(extract("a.ts", code), Ok(vec!["Typed".to_string()]));
		let code = r#"
			import {t} from '@bluecateng/l10n.macro';
			export const A = (p: {n: number}) => <b>{t`Component`}</b>;
		"#;
		assert_eq!(extract("a.tsx", code), Ok(vec!["Component".to_string()]));
	}

	#[test]
	fn reports_errors_with_location() {
		let code = "import {t, select, foo} from '@bluecateng/l10n.macro';\nt();\nselect`x`;\nconst x = t;\n";
		assert_eq!(
			extract("/src/a.js", code),
			Err(vec![
				"/src/a.js:1:20: Unknown macro \"foo\"".to_string(),
				"/src/a.js:2:1: This macro requires one argument".to_string(),
				"/src/a.js:3:1: Only the t macro can be used as a template tag".to_string(),
				"/src/a.js:4:11: Macros can only be called or used as template tags".to_string(),
			])
		);
	}

	#[test]
	fn reports_parse_errors() {
		let code = "import {t} from '@bluecateng/l10n.macro';\nconst x = do { 1 };\n";
		let errors = extract("/src/a.js", code).unwrap_err();
		assert_eq!(errors.len(), 1);
		assert!(errors[0].starts_with("/src/a.js:2:"), "{}", errors[0]);
	}

	#[test]
	fn finds_files() {
		let tmp = tempfile::tempdir().unwrap();
		let src = tmp.path().join("src");
		fs::create_dir_all(src.join("d")).unwrap();
		for name in ["a.js", "b.jsx", "c.ts", "d/e.tsx", "f.css", "d/g.mjs"] {
			fs::write(src.join(name), "").unwrap();
		}
		let mut files = find_files(&src, tmp.path(), &[]).unwrap();
		files.sort();
		let expected: Vec<_> = ["a.js", "b.jsx", "c.ts", "d/e.tsx"]
			.iter()
			.map(|name| src.join(name))
			.collect();
		assert_eq!(files, expected);

		let sources = ["src/a.js", "src/f.css", "other/x.js", "src-other/y.js", "src/../z.js"].map(String::from);
		assert_eq!(find_files(&src, tmp.path(), &sources).unwrap(), vec![src.join("a.js")]);
		assert_eq!(
			find_files(&src, tmp.path(), &[src.join("c.ts").to_string_lossy().into_owned()]).unwrap(),
			vec![src.join("c.ts")]
		);
	}

	#[test]
	fn fails_if_source_path_is_missing() {
		let tmp = tempfile::tempdir().unwrap();
		assert!(find_files(&tmp.path().join("nope"), tmp.path(), &[])
			.unwrap_err()
			.starts_with("Error scanning "));
	}

	#[test]
	fn extracts_files_in_parallel() {
		let tmp = tempfile::tempdir().unwrap();
		let files: Vec<_> = (0..50)
			.map(|i| {
				let path = tmp.path().join(format!("f{i}.js"));
				let code = format!("import {{t}} from '@bluecateng/l10n.macro';\nt`String {}`;", i % 10);
				fs::write(&path, code).unwrap();
				path
			})
			.collect();
		let strings = extract_files(&files).unwrap();
		assert_eq!(strings.len(), 10);
		assert!(strings.contains("String 7"));

		fs::write(&files[3], "import {t} from '@bluecateng/l10n.macro';\nt();").unwrap();
		fs::write(&files[1], "import {t} from '@bluecateng/l10n.macro';\nt(1, 2);").unwrap();
		let errors = extract_files(&files).unwrap_err();
		assert_eq!(errors.len(), 2);
		assert!(errors[0].contains("f1.js"), "{errors:?}");
		assert!(errors[1].contains("f3.js"), "{errors:?}");
	}

	#[test]
	fn reports_missing_files() {
		let errors = extract_files(&[PathBuf::from("/nonexistent/a.js")]).unwrap_err();
		assert!(errors[0].starts_with("Error reading /nonexistent/a.js: "));
	}
}

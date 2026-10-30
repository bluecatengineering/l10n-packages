use std::{fs, path::PathBuf};

use l10n_swc_plugin::{l10n_macro, Options};
use serde_json::Value;
use swc_core::{
	common::Mark,
	ecma::{
		parser::{EsSyntax, Syntax},
		transforms::{
			base::resolver,
			testing::{test_fixture, FixtureTestConfig},
		},
	},
};

#[testing::fixture("tests/fixture/**/input.js")]
fn fixture(input: PathBuf) {
	let dir = input.parent().unwrap();
	let options: Value = fs::read_to_string(dir.join("options.json"))
		.map(|json| serde_json::from_str(&json).unwrap())
		.unwrap_or(Value::Null);
	test_fixture(
		Syntax::Es(EsSyntax {
			jsx: true,
			..Default::default()
		}),
		&|t| {
			let unresolved_mark = Mark::new();
			let top_level_mark = Mark::new();
			(
				resolver(unresolved_mark, top_level_mark, false),
				l10n_macro(
					t.comments.clone(),
					Options {
						import_source: "./l10n".into(),
						hash_length: options["hashLength"].as_u64().map(|length| length as usize),
					},
				),
			)
		},
		&input,
		&dir.join("output.js"),
		FixtureTestConfig {
			allow_error: dir.join("output.stderr").exists(),
			module: Some(true),
			..Default::default()
		},
	);
}

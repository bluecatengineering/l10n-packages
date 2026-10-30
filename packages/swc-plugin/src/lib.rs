use serde::Deserialize;
use swc_core::{
	common::plugin::metadata::TransformPluginMetadataContextKind,
	ecma::ast::Program,
	plugin::{plugin_transform, proxies::TransformPluginProgramMetadata},
};

mod convert;
mod path;
mod transform;

pub use transform::{l10n_macro, Options};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Config {
	/// Path to the l10n module, relative paths are resolved from the current working directory.
	module: String,
	hash_length: Option<usize>,
}

#[plugin_transform]
fn process_transform(program: Program, metadata: TransformPluginProgramMetadata) -> Program {
	let config = metadata
		.get_transform_plugin_config()
		.expect("The l10n plugin requires a configuration with the \"module\" path");
	let config: Config = serde_json::from_str(&config).expect("Invalid l10n plugin configuration");
	let filename = metadata
		.get_context(&TransformPluginMetadataContextKind::Filename)
		.expect("The l10n plugin requires the file name");
	let cwd = metadata
		.get_context(&TransformPluginMetadataContextKind::Cwd)
		.unwrap_or_else(|| "/".into());
	let options = Options {
		import_source: path::import_source(&cwd, &filename, &config.module),
		hash_length: config.hash_length,
	};
	program.apply(l10n_macro(metadata.comments, options))
}

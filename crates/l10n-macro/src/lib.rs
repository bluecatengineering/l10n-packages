//! Code shared by the SWC plugin and the CLI to find the l10n macros and convert them to ICU strings.

use std::{collections::HashMap, fmt};

use sha1::{Digest, Sha1};
use swc_core::{common::Spanned, ecma::ast::*};

mod convert;

pub use convert::{convert_call, convert_template, Context, Error, Macro, Result};

pub const MACRO_MODULE: &str = "@bluecateng/l10n.macro";

/// Adds the macros imported by `decl` to `macros`, returns the errors found in the import.
pub fn register_import(decl: &ImportDecl, macros: &mut HashMap<Id, Macro>) -> Vec<Error> {
	let mut errors = vec![];
	if decl.type_only {
		return errors;
	}
	for specifier in &decl.specifiers {
		match specifier {
			ImportSpecifier::Named(ImportNamedSpecifier {
				local,
				imported,
				is_type_only: false,
				..
			}) => {
				let name = match imported {
					Some(ModuleExportName::Ident(ident)) => ident.sym.to_string(),
					Some(ModuleExportName::Str(str)) => str.value.to_string_lossy().into_owned(),
					None => local.sym.to_string(),
				};
				match Macro::from_name(&name) {
					Some(m) => {
						macros.insert(local.to_id(), m);
					}
					None => errors.push(Error {
						span: specifier.span(),
						message: format!("Unknown macro \"{name}\""),
					}),
				}
			}
			ImportSpecifier::Named(_) => {}
			_ => errors.push(Error {
				span: specifier.span(),
				message: "Only named imports are supported".into(),
			}),
		}
	}
	errors
}

/// Returned when two different strings have the same hash, contains the key anyway.
#[derive(Debug, PartialEq, Eq)]
pub struct DuplicatedHash(pub String);

impl fmt::Display for DuplicatedHash {
	fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
		f.write_str("Duplicated hash, increase hash length")
	}
}

/// Builds the message keys, which are either the ICU string or its truncated SHA-1 hash.
pub struct KeyBuilder {
	hash_length: Option<usize>,
	hashes: HashMap<String, String>,
}

impl KeyBuilder {
	pub fn new(hash_length: Option<usize>) -> Self {
		Self {
			hash_length: hash_length.filter(|&length| length > 0),
			hashes: HashMap::new(),
		}
	}

	pub fn is_hashed(&self) -> bool {
		self.hash_length.is_some()
	}

	pub fn build(&mut self, string: &str) -> std::result::Result<String, DuplicatedHash> {
		let Some(length) = self.hash_length else {
			return Ok(string.to_string());
		};
		let digest = Sha1::digest(string.as_bytes());
		let hex = digest.iter().map(|b| format!("{b:02x}")).collect::<String>();
		let hash = hex.get(..length).unwrap_or(&hex).to_string();
		match self.hashes.get(&hash) {
			Some(old) if old != string => Err(DuplicatedHash(hash)),
			Some(_) => Ok(hash),
			None => {
				self.hashes.insert(hash.clone(), string.to_string());
				Ok(hash)
			}
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn key_without_hash() {
		let mut keys = KeyBuilder::new(None);
		assert!(!keys.is_hashed());
		assert_eq!(keys.build("Hello"), Ok("Hello".to_string()));
	}

	#[test]
	fn key_with_zero_length_is_not_hashed() {
		assert!(!KeyBuilder::new(Some(0)).is_hashed());
	}

	#[test]
	fn key_with_hash() {
		let mut keys = KeyBuilder::new(Some(6));
		assert_eq!(keys.build(""), Ok("da39a3".to_string()));
		assert_eq!(keys.build(""), Ok("da39a3".to_string()));
	}

	#[test]
	fn key_longer_than_hash() {
		assert_eq!(KeyBuilder::new(Some(50)).build("").unwrap().len(), 40);
	}

	#[test]
	fn duplicated_hash() {
		let mut keys = KeyBuilder::new(Some(1));
		let mut seen = HashMap::new();
		// with a single hex digit a collision is found quickly
		let duplicate = (0..100)
			.map(|i| i.to_string())
			.find_map(|string| match keys.build(&string) {
				Ok(hash) => {
					seen.insert(hash, string);
					None
				}
				Err(error) => Some(error),
			})
			.unwrap();
		assert!(seen.contains_key(&duplicate.0));
		assert_eq!(duplicate.to_string(), "Duplicated hash, increase hash length");
	}
}

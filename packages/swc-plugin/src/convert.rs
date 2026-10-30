//! Port of `@bluecateng/l10n-ast2icu`. The generated strings are used as message keys and must match what
//! `l10n-cli` extracts, so any change here must be mirrored there.

use std::{borrow::Cow, collections::HashMap};

use swc_core::{
	atoms::Wtf8Atom,
	common::{Span, Spanned},
	ecma::ast::*,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Macro {
	T,
	Select,
	Plural,
	SelectOrdinal,
	Number,
}

impl Macro {
	pub fn from_name(name: &str) -> Option<Self> {
		match name {
			"t" => Some(Self::T),
			"select" => Some(Self::Select),
			"plural" => Some(Self::Plural),
			"selectOrdinal" => Some(Self::SelectOrdinal),
			"number" => Some(Self::Number),
			_ => None,
		}
	}
}

pub struct Error {
	pub span: Span,
	pub message: String,
}

pub type Result<T> = std::result::Result<T, Error>;

fn error<T>(span: Span, message: impl Into<String>) -> Result<T> {
	Err(Error {
		span,
		message: message.into(),
	})
}

pub struct Context<'a> {
	macros: &'a HashMap<Id, Macro>,
	pub named_args: Vec<Ident>,
	pub num_args: Vec<Expr>,
}

impl<'a> Context<'a> {
	pub fn new(macros: &'a HashMap<Id, Macro>) -> Self {
		Self {
			macros,
			named_args: vec![],
			num_args: vec![],
		}
	}

	fn add_named_arg(&mut self, ident: &Ident) -> String {
		if !self.named_args.iter().any(|named| named.sym == ident.sym) {
			self.named_args.push(ident.clone());
		}
		ident.sym.to_string()
	}

	fn add_num_arg(&mut self, expr: &Expr) -> String {
		self.num_args.push(expr.clone());
		(self.num_args.len() - 1).to_string()
	}

	fn macro_for(&self, call: &CallExpr) -> Option<Macro> {
		match &call.callee {
			Callee::Expr(callee) => match &**callee {
				Expr::Ident(ident) => self.macros.get(&ident.to_id()).copied(),
				_ => None,
			},
			_ => None,
		}
	}
}

enum Key {
	Ident(String),
	Str(String),
	Num(f64),
}

impl Key {
	fn is(&self, name: &str) -> bool {
		matches!(self, Key::Ident(key) if key == name)
	}
}

struct Choice<'a> {
	key: Key,
	value: Cow<'a, Expr>,
}

/// Formats a number the same way JavaScript does when converting it to a string, for the values that can be
/// expected in a numeric literal used as a choice key.
fn js_number(value: f64) -> String {
	if value.fract() == 0.0 && value.abs() < 1e21 {
		format!("{value:.0}")
	} else {
		value.to_string()
	}
}

fn str_value(value: &Wtf8Atom) -> String {
	value.to_string_lossy().into_owned()
}

fn call_args(call: &CallExpr) -> Result<Vec<&Expr>> {
	call.args
		.iter()
		.map(|arg| match arg.spread {
			Some(span) => error(span, "Spread arguments are not supported"),
			None => Ok(&*arg.expr),
		})
		.collect()
}

fn convert_argument(expr: &Expr, ctx: &mut Context) -> String {
	match expr.unwrap_parens() {
		Expr::Ident(ident) => ctx.add_named_arg(ident),
		_ => ctx.add_num_arg(expr),
	}
}

fn convert_expression(expr: &Expr, ctx: &mut Context) -> Result<String> {
	match expr.unwrap_parens() {
		Expr::Lit(Lit::Str(str)) => Ok(str_value(&str.value)),
		Expr::Tpl(tpl) => convert_template(tpl, ctx),
		Expr::Ident(ident) => Ok(format!("{{{}}}", ctx.add_named_arg(ident))),
		Expr::Call(call) => match ctx.macro_for(call) {
			Some(m) => convert_call(m, call, ctx),
			None => Ok(format!("{{{}}}", ctx.add_num_arg(expr))),
		},
		_ => Ok(format!("{{{}}}", ctx.add_num_arg(expr))),
	}
}

fn convert_choices<'a>(object: &'a ObjectLit) -> Result<Vec<Choice<'a>>> {
	object
		.props
		.iter()
		.map(|prop| match prop {
			PropOrSpread::Prop(prop) => match &**prop {
				Prop::KeyValue(KeyValueProp { key, value }) => {
					let key = match key {
						PropName::Ident(ident) => Key::Ident(ident.sym.to_string()),
						PropName::Str(str) => Key::Str(str_value(&str.value)),
						PropName::Num(num) => Key::Num(num.value),
						_ => return error(key.span(), "Choice keys must be identifiers, strings, or numbers"),
					};
					Ok(Choice {
						key,
						value: Cow::Borrowed(&**value),
					})
				}
				Prop::Shorthand(ident) => Ok(Choice {
					key: Key::Ident(ident.sym.to_string()),
					value: Cow::Owned(Expr::Ident(ident.clone())),
				}),
				_ => error(prop.span(), "Choices must be key-value properties"),
			},
			PropOrSpread::Spread(spread) => error(spread.span(), "Choices must be key-value properties"),
		})
		.collect()
}

fn convert_selection(call: &CallExpr, ctx: &mut Context, kind: &str, plural: bool) -> Result<String> {
	let args = call_args(call)?;
	if args.len() != 2 {
		return error(call.span, "This macro requires two arguments");
	}
	let arg1 = args[1];
	let Expr::Object(object) = arg1.unwrap_parens() else {
		return error(arg1.span(), "The second argument must be an object literal");
	};
	let choices = convert_choices(object)?;
	if !choices.iter().any(|choice| choice.key.is("other")) {
		return error(arg1.span(), "There must be a choice with the key \"other\"");
	}
	if plural && choices.iter().skip(1).any(|choice| choice.key.is("offset")) {
		return error(arg1.span(), "The offset must be the first choice");
	}

	let choices = choices
		.iter()
		.map(|Choice { key, value }| {
			if plural && key.is("offset") {
				return match value.unwrap_parens() {
					Expr::Lit(Lit::Num(num)) => Ok(format!("offset:{}", js_number(num.value))),
					_ => error(value.span(), "The offset must be a number literal"),
				};
			}
			let key = match key {
				Key::Ident(name) | Key::Str(name) => name.clone(),
				Key::Num(value) if plural => format!("={}", js_number(*value)),
				Key::Num(value) => js_number(*value),
			};
			Ok(format!("{key} {{{}}}", convert_expression(value, ctx)?))
		})
		.collect::<Result<Vec<_>>>()?
		.join(" ");
	// the choices must be converted before the argument so the numeric arguments are in the same order as in ast2icu
	Ok(format!("{{{}, {kind}, {choices}}}", convert_argument(args[0], ctx)))
}

pub fn convert_template(tpl: &Tpl, ctx: &mut Context) -> Result<String> {
	let mut string = String::new();
	for (i, quasi) in tpl.quasis.iter().enumerate() {
		let Some(cooked) = &quasi.cooked else {
			return error(quasi.span, "Invalid escape sequence in template");
		};
		string.push_str(&str_value(cooked));
		if let Some(expr) = tpl.exprs.get(i) {
			string.push_str(&convert_expression(expr, ctx)?);
		}
	}
	Ok(string)
}

pub fn convert_call(m: Macro, call: &CallExpr, ctx: &mut Context) -> Result<String> {
	match m {
		Macro::T => {
			let args = call_args(call)?;
			if args.len() != 1 {
				return error(call.span, "This macro requires one argument");
			}
			convert_expression(args[0], ctx)
		}
		Macro::Select => convert_selection(call, ctx, "select", false),
		Macro::Plural => convert_selection(call, ctx, "plural", true),
		Macro::SelectOrdinal => convert_selection(call, ctx, "selectordinal", true),
		Macro::Number => {
			let args = call_args(call)?;
			match args[..] {
				[arg] => Ok(format!("{{{}, number}}", convert_argument(arg, ctx))),
				[arg, style] => match style.unwrap_parens() {
					Expr::Lit(Lit::Str(str)) => Ok(format!(
						"{{{}, number, {}}}",
						convert_argument(arg, ctx),
						str_value(&str.value)
					)),
					_ => error(style.span(), "The second argument must be a string literal"),
				},
				_ => error(call.span, "This macro requires one or two arguments"),
			}
		}
	}
}

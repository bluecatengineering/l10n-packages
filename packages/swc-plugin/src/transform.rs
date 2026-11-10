use std::collections::HashMap;

use l10n_macro::{convert_call, convert_template, register_import, Context, KeyBuilder, Macro, MACRO_MODULE};
use swc_core::{
	common::{
		comments::{Comment, CommentKind, Comments},
		errors::HANDLER,
		Mark, Span, Spanned, SyntaxContext, DUMMY_SP,
	},
	ecma::{
		ast::*,
		visit::{visit_mut_pass, VisitMut, VisitMutWith},
	},
};

pub struct Options {
	/// The specifier used to import the l10n module.
	pub import_source: String,
	/// The length of the hash used as key, if not set the ICU string is used as key.
	pub hash_length: Option<usize>,
}

pub fn l10n_macro<C: Comments>(comments: C, options: Options) -> impl Pass {
	visit_mut_pass(L10nMacro {
		comments,
		keys: KeyBuilder::new(options.hash_length),
		options,
		macros: HashMap::new(),
		l10n: None,
	})
}

struct L10nMacro<C: Comments> {
	comments: C,
	options: Options,
	macros: HashMap<Id, Macro>,
	keys: KeyBuilder,
	l10n: Option<Ident>,
}

fn emit_error(span: Span, message: &str) {
	HANDLER.with(|handler| handler.struct_span_err(span, message).emit());
}

fn is_import(item: &ModuleItem) -> bool {
	matches!(item, ModuleItem::ModuleDecl(ModuleDecl::Import(_)))
}

fn is_directive(item: &ModuleItem) -> bool {
	matches!(item, ModuleItem::Stmt(Stmt::Expr(ExprStmt { expr, .. })) if matches!(&**expr, Expr::Lit(Lit::Str(_))))
}

impl<C: Comments> L10nMacro<C> {
	fn register_import(&mut self, decl: &ImportDecl) {
		for error in register_import(decl, &mut self.macros) {
			emit_error(error.span, &error.message);
		}
	}

	fn macro_for_ident(&self, expr: &Expr) -> Option<Macro> {
		match expr {
			Expr::Ident(ident) => self.macros.get(&ident.to_id()).copied(),
			_ => None,
		}
	}

	fn macro_for_call(&self, call: &CallExpr) -> Option<Macro> {
		match &call.callee {
			Callee::Expr(callee) => self.macro_for_ident(callee),
			_ => None,
		}
	}

	fn build_key(&mut self, string: &str, span: Span) -> String {
		self.keys.build(string).unwrap_or_else(|error| {
			emit_error(span, &error.to_string());
			error.0
		})
	}

	fn replace_macro(&mut self, expr: &mut Expr) {
		let span = expr.span();
		let mut ctx = Context::new(&self.macros);
		let result = match &*expr {
			Expr::TaggedTpl(tagged) => convert_template(&tagged.tpl, &mut ctx),
			Expr::Call(call) => convert_call(self.macro_for_call(call).unwrap(), call, &mut ctx),
			_ => unreachable!(),
		};
		let string = match result {
			Ok(string) => string,
			Err(error) => return emit_error(error.span, &error.message),
		};
		let Context {
			named_args, num_args, ..
		} = ctx;

		let mut args = vec![Expr::from(self.build_key(&string, span)).into()];
		if !named_args.is_empty() || !num_args.is_empty() {
			let named = named_args
				.into_iter()
				.map(|ident| PropOrSpread::Prop(Box::new(Prop::Shorthand(ident))));
			let num = num_args.into_iter().enumerate().map(|(index, mut value)| {
				// numeric arguments can contain other macro calls
				value.visit_mut_with(self);
				PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
					key: PropName::Num(Number {
						span: DUMMY_SP,
						value: index as f64,
						raw: None,
					}),
					value: Box::new(value),
				})))
			});
			args.push(
				Expr::Object(ObjectLit {
					span: DUMMY_SP,
					props: named.chain(num).collect(),
				})
				.into(),
			);
		}

		let l10n = self
			.l10n
			.get_or_insert_with(|| Ident::new("_l10n".into(), DUMMY_SP, SyntaxContext::empty().apply_mark(Mark::new())))
			.clone();
		*expr = Expr::Call(CallExpr {
			span,
			callee: Callee::Expr(Box::new(Expr::Ident(l10n))),
			args,
			..Default::default()
		});
		self.comments.add_pure_comment(span.lo);
		self.comments.add_trailing(
			span.hi,
			Comment {
				kind: CommentKind::Block,
				span: DUMMY_SP,
				text: format!("l10n: {}", string.replace("*/", "*\\/")).into(),
			},
		);
	}
}

impl<C: Comments> VisitMut for L10nMacro<C> {
	fn visit_mut_module(&mut self, module: &mut Module) {
		module.body.retain(|item| match item {
			ModuleItem::ModuleDecl(ModuleDecl::Import(decl)) if &*decl.src.value == MACRO_MODULE => {
				self.register_import(decl);
				false
			}
			_ => true,
		});
		if self.macros.is_empty() {
			return;
		}

		module.visit_mut_children_with(self);

		if let Some(l10n) = self.l10n.take() {
			let position = match module.body.iter().rposition(is_import) {
				Some(index) => index + 1,
				None => module.body.iter().take_while(|item| is_directive(item)).count(),
			};
			module.body.insert(
				position,
				ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
					span: DUMMY_SP,
					specifiers: vec![ImportSpecifier::Default(ImportDefaultSpecifier {
						span: DUMMY_SP,
						local: l10n,
					})],
					src: Box::new(self.options.import_source.as_str().into()),
					type_only: false,
					with: None,
					phase: Default::default(),
				})),
			);
		}
	}

	fn visit_mut_expr(&mut self, expr: &mut Expr) {
		match expr {
			Expr::TaggedTpl(tagged) => match self.macro_for_ident(&tagged.tag) {
				Some(Macro::T) => self.replace_macro(expr),
				Some(_) => emit_error(tagged.tag.span(), "Only the t macro can be used as a template tag"),
				None => expr.visit_mut_children_with(self),
			},
			Expr::Call(call) if self.macro_for_call(call).is_some() => self.replace_macro(expr),
			Expr::Ident(ident) if self.macros.contains_key(&ident.to_id()) => {
				emit_error(ident.span, "Macros can only be called or used as template tags")
			}
			_ => expr.visit_mut_children_with(self),
		}
	}
}

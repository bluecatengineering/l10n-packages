import PO from 'pofile';

const collator = new Intl.Collator('en', {sensitivity: 'base'});

export default (locale, catalogPath, strings, addReferences, clean, markObsolete) =>
	new Promise((resolve, reject) => {
		const fileName = `${catalogPath.replace(/{locale}/, locale)}.po`;
		PO.load(fileName, (err, po) => {
			if (err && err.code !== 'ENOENT') {
				return reject(new Error(`Error loading ${fileName}: ${err.message}`));
			}

			let changed = false;
			const newStrings = new Set(strings);

			if (!po) {
				po = new PO();
				po.headers = {
					'POT-Creation-Date': new Date().toISOString(),
					'Mime-Version': '1.0',
					'Content-Type': 'text/plain; charset=utf-8',
					'Content-Transfer-Encoding': '8bit',
					'X-Generator': '@bluecateng/l10n-cli',
					Language: locale,
				};
			} else {
				let needsCleaning;
				for (const item of po.items) {
					const msgid = item.msgid;
					if (newStrings.has(msgid)) {
						newStrings.delete(msgid);
						if (item.obsolete) {
							item.obsolete = false;
							changed = true;
						}
					} else if (markObsolete) {
						item.obsolete = true;
						changed = true;
					}
					if (item.obsolete) {
						needsCleaning = true;
					}
				}
				if (clean && needsCleaning) {
					changed = true;
					po.items = po.items.filter(({obsolete}) => !obsolete);
				}
			}

			const items = po.items || [];
			if (newStrings.size) {
				for (const msgid of newStrings) {
					const item = new PO.Item();
					item.msgid = msgid;
					addReferences(item);
					items.push(item);
				}
				changed = true;
			}

			if (changed) {
				po.items = items.sort((a, b) => collator.compare(a.msgid, b.msgid));
				return po.save(fileName, (err) => {
					if (err) {
						return reject(new Error(`Error saving ${fileName}: ${err.message}`));
					}
					return resolve();
				});
			}

			return resolve();
		});
	});

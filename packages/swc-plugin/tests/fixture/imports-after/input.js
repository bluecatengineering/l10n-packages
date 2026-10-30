import {useState} from 'react';
import {t} from '@bluecateng/l10n.macro';
import {Button} from './Button';

export default function Component() {
	const [count] = useState(0);
	return <Button title={t`Count ${count}`}>{t`Click me`}</Button>;
}

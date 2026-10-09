import type { KeyboardEvent } from 'react';

// Enter sends; Shift+Enter adds a line. When typing Chinese, Japanese or Korean,
// Enter also confirms the chosen characters and must not send. Safari marks that
// Enter with keyCode 229 instead of isComposing.
export const isSendKey = (event: KeyboardEvent): boolean =>
	event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229;

import type { UIMessage } from '@ai-sdk/react';

type Part = UIMessage['parts'][number];

interface FilePart {
	type: 'file';
	mediaType?: string;
	url?: string;
	name?: string;
}

const isFilePart = (part: Part): part is Part & FilePart => part.type === 'file';

export const getMessageText = (parts: UIMessage['parts']): string | undefined => {
	const textParts = parts.filter(part => part.type === 'text');
	if (textParts.length === 0) return undefined;
	return textParts.map(p => p.text).join('');
};

export const getReasoningTitle = (text: string | undefined): string => {
	if (!text) return '';
	const firstLine = text.split('\n')[0];
	const match = firstLine?.match(/\*\*(.*?)\*\*/);
	return match ? `${match[1]}...` : '';
};

export const getReasoningTitleFromMessage = (parts: UIMessage['parts']): string => {
	const reasoningPart = [...parts].reverse().find(part =>
		part.type === 'reasoning' && part.text && getReasoningTitle(part.text),
	);

	return reasoningPart?.type === 'reasoning' ? getReasoningTitle(reasoningPart.text) : '';
};

export const getImageAttachments = (parts: UIMessage['parts']): Array<Part & FilePart> =>
	parts.filter((part): part is Part & FilePart =>
		isFilePart(part) && Boolean(part.mediaType?.startsWith('image/')),
	);

export const getFileAttachments = (parts: UIMessage['parts']): Array<Part & FilePart> =>
	parts.filter((part): part is Part & FilePart =>
		isFilePart(part) && !part.mediaType?.startsWith('image/'),
	);

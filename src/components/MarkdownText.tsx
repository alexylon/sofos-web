import { memo, useMemo, useCallback, ReactNode, HTMLAttributes } from 'react';
import Markdown from 'react-markdown';
import type { Components, ExtraProps } from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { AppBar, Box, Toolbar, useTheme } from '@mui/material';
import { CopyToClipboardButton } from '@/components/CopyToClipboardButton';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import { grey } from '@/theme/theme';
import { CODE_BLOCK_RADIUS } from '@/components/utils/constants';

interface MarkdownTextProps {
	children: ReactNode;
}

const MemoizedMarkdown = memo(Markdown);

const MarkdownText = ({ children }: MarkdownTextProps) => {
	const remarkPlugins = useMemo(() => [remarkMath], []);
	const rehypePlugins = useMemo(() => [rehypeKatex], []);
	const theme = useTheme();

	const CodeBlock = useCallback(
		function CodeBlock({ className, children: codeChildren, ...rest }: HTMLAttributes<HTMLElement> & ExtraProps) {
			const match = /language-(\w+)/.exec(className || '');
			const codeText = String(codeChildren).replace(/\n$/, '');

			if (!match) {
				return (
					<code
						className={className}
						{...rest}
						style={{ fontWeight: 'bold' }}
					>
						{codeChildren}
					</code>
				);
			}

			return (
				<Box sx={{ mt: 3 }}>
					<Box sx={{ flexGrow: 1 }}>
						<AppBar
							position="static"
							color="primary"
							sx={{
								backgroundColor: '#505050',
								borderRadius: CODE_BLOCK_RADIUS,
								zIndex: 'modal',
								mb: '-10px',
							}}
							elevation={0}
						>
							<Toolbar variant="dense">
								<Box sx={{ display: 'flex' }}>{match[1]}</Box>
								<Box sx={{ flexGrow: 10 }} />
								<Box sx={{ display: 'flex', mr: -1 }}>
									<CopyToClipboardButton
										value={codeText}
										color={theme.palette.mode === 'dark' ? grey[400] : grey[350]}
									/>
								</Box>
							</Toolbar>
						</AppBar>
					</Box>
					<SyntaxHighlighter
						style={dracula}
						customStyle={{ borderRadius: '0 0 13px 13px' }}
						language={match[1]}
						PreTag="div"
						showLineNumbers={false}
						codeTagProps={{
							style: {
								fontSize: '0.9rem',
								fontFamily: 'var(--font-mono)',
							},
						}}
					>
						{codeText}
					</SyntaxHighlighter>
				</Box>
			);
		},
		[theme.palette.mode],
	);

	const components = useMemo<Components>(
		() => ({ code: CodeBlock }),
		[CodeBlock],
	);

	return (
		<MemoizedMarkdown
			remarkPlugins={remarkPlugins}
			rehypePlugins={rehypePlugins}
			components={components}
		>
			{typeof children === 'string' ? children : String(children ?? '')}
		</MemoizedMarkdown>
	);
};

export default MarkdownText;

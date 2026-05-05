import { Box, Card, useTheme } from '@mui/material';

interface ImageBoxProps {
	file: File;
	index: number;
	fileURL: string;
}

const ImageBox = ({ file, index, fileURL }: ImageBoxProps) => {
	const theme = useTheme();

	return (
		<Card
			sx={{
				height: 50,
				width: 50,
				borderRadius: theme.shape.borderRadius,
				mr: '4px',
				mb: '-6px',
				display: 'inline-block',
				overflow: 'hidden',
			}}
		>
			<Box
				sx={{
					height: 50,
					width: 50,
					overflow: 'hidden',
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
				}}
			>
				<Box
					component="img"
					sx={{
						width: '100%',
						height: '100%',
						objectFit: 'cover',
					}}
					alt={file.name ?? `attachment-${index}`}
					src={fileURL}
				/>
			</Box>
		</Card>
	);
};

export default ImageBox;

import ImageBox from '@/components/ImageBox';
import { Box, Card, IconButton, useTheme } from '@mui/material';
import ClearOutlinedIcon from '@mui/icons-material/ClearOutlined';

interface AttachmentsContainerProps {
	hasImages: boolean;
	hasFiles: boolean;
	images: File[];
	files: File[];
	handleRemoveImage: (index: number) => void;
	handleRemoveFile: (index: number) => void;
}

const AttachmentsContainer = ({
	hasImages,
	hasFiles,
	images,
	files,
	handleRemoveImage,
	handleRemoveFile,
}: AttachmentsContainerProps) => {
	const theme = useTheme();

	return (
		<Box sx={{ display: 'flex', flexDirection: 'row', mb: 1 }}>
			{hasImages &&
				images.map((file, index) => {
					const fileURL = URL.createObjectURL(file);
					return (
						<div key={index}>
							<ImageBox
								index={index}
								file={file}
								fileURL={fileURL}
							/>
							<IconButton
								sx={{
									transform: 'translate(-70%, -120%)',
									backgroundColor: 'rgba(100, 100, 100, 0.8)',
									borderRadius: '50%',
									boxShadow: 1,
									height: '20px',
									width: '20px',
									ml: -2,
								}}
								size="small"
								onClick={() => handleRemoveImage(index)}
							>
								<ClearOutlinedIcon />
							</IconButton>
						</div>
					);
				})
			}
			{hasFiles &&
				files.map((file, index) => (
					<Box key={index}>
						<Card
							sx={{
								maxWidth: 100,
								height: 50,
								position: 'relative',
								display: 'flex',
								alignItems: 'center',
								paddingRight: '10px',
								mr: 1,
								backgroundColor: '#a9eae0',
								borderRadius: theme.shape.borderRadius,
							}}
						>
							<IconButton
								sx={{
									position: 'absolute',
									top: 6,
									right: 6,
									backgroundColor: 'rgba(255, 255, 255, 0.5)',
									borderRadius: '50%',
									boxShadow: 1,
									height: '20px',
									width: '20px',
								}}
								size="small"
								onClick={() => handleRemoveFile(index)}
							>
								<ClearOutlinedIcon />
							</IconButton>
							<Box
								sx={{
									overflow: 'hidden',
									textOverflow: 'ellipsis',
									whiteSpace: 'nowrap',
									ml: 1,
									color: '#707070',
								}}
							>
								{file.name}
							</Box>
						</Card>
					</Box>
				))
			}
		</Box>
	);
};

export default AttachmentsContainer;

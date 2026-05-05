import { useEffect, useRef, useState } from 'react';
import { IconButton, useTheme } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import {
	HINT_AUTO_DISMISS_MS,
	MAX_KEPT_SILENCE_MS,
	MIC_ICON_SIZE,
	MIN_RECORDING_MS,
	RECORDING_TIMESLICE_MS,
	SAFETY_MAX_RECORDING_MS,
	SIMPLIFIED_MAX_RECORDING_MS,
	TARGET_SAMPLE_RATE_HZ,
} from '@/components/utils/constants';
import { getAudioContextClass, isIOSSafari, isPWA } from '@/components/utils/platform';
import { convertToWav } from '@/components/utils/audio/wavEncoder';
import { SilenceDetector, startSilenceDetector } from '@/components/utils/audio/silenceDetector';

interface AudioRecorderProps {
	disabled?: boolean;
	onTranscriptionResult: (text: string) => void;
	onError?: (error: string) => void;
}

const RECORDING_HINT = 'Recording now... Tap the microphone to stop';
const RECORDING_FAILED_HINT = 'Recording failed';

const pickMimeType = (): string => {
	if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
	if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
	return '';
};

const resolveBlobMimeType = (mimeType: string): string => {
	if (mimeType) return mimeType;
	return MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
};

const buildAudioConstraints = (useSimplified: boolean): MediaTrackConstraints | true => {
	if (useSimplified) return true;
	if (isIOSSafari()) return { echoCancellation: true, noiseSuppression: true };
	return { sampleRate: TARGET_SAMPLE_RATE_HZ, channelCount: 1, echoCancellation: true, noiseSuppression: true };
};

const AudioRecorder: React.FC<AudioRecorderProps> = ({
	disabled = false,
	onTranscriptionResult,
	onError,
}) => {
	const theme = useTheme();

	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const detectorRef = useRef<SilenceDetector | null>(null);

	const isCurrentlySilentRef = useRef<boolean>(true);
	const chunksRef = useRef<Blob[]>([]);
	const pendingSilenceChunksRef = useRef<Blob[]>([]);

	const recordingStartTimeRef = useRef<number>(0);
	const [isRecording, setIsRecording] = useState(false);
	const [isTranscribing, setIsTranscribing] = useState(false);
	const [recordingError, setRecordingError] = useState<string | null>(null);
	const [hint, setHint] = useState<string | null>(null);

	const cleanupDetector = () => {
		if (detectorRef.current) {
			detectorRef.current.close();
			detectorRef.current = null;
		}
		isCurrentlySilentRef.current = true;
	};

	const cleanupStream = () => {
		if (streamRef.current) {
			streamRef.current.getTracks().forEach(t => t.stop());
			streamRef.current = null;
		}
	};

	const stopRecording = (fromAutoStop = false) => {
		const recorder = mediaRecorderRef.current;

		if (!recorder || recorder.state === 'inactive') {
			setIsRecording(false);
			setHint(null);
			return;
		}

		const doStop = () => {
			try {
				recorder.stop();
			} catch {} finally {
				mediaRecorderRef.current = null;
				setIsRecording(false);
				setHint(null);
			}
		};

		if (!fromAutoStop && detectorRef.current) {
			const recordingDuration = Date.now() - recordingStartTimeRef.current;
			const remaining = Math.max(0, MIN_RECORDING_MS - recordingDuration);

			if (remaining > 0) {
				setTimeout(doStop, remaining);
				return;
			}
		}

		doStop();
	};

	const transcribeAudio = async (audioBlob: Blob) => {
		try {
			setIsTranscribing(true);
			setRecordingError(null);

			const wavBlob = await convertToWav(audioBlob);

			const formData = new FormData();
			formData.append('audio', new File([wavBlob], 'recording.wav', { type: 'audio/wav' }));

			const response = await fetch('/api/transcribe', {
				method: 'POST',
				body: formData,
			});

			if (!response.ok) {
				const errorText = await response.text();
				let errorMessage: string;

				try {
					const errorJson = JSON.parse(errorText);
					errorMessage = `Transcription failed: ${errorJson.message || errorJson.error || 'Unknown error'}`;
				} catch {
					errorMessage = `Transcription failed: ${response.status} ${response.statusText}`;
				}

				setRecordingError(errorMessage);
				onError?.(errorMessage);
				return;
			}

			const result = await response.json();

			if (!result.text || !result.text.trim()) return;

			const trimmedText = result.text.trim();

			try {
				if (isIOSSafari() || isPWA()) {
					setTimeout(() => onTranscriptionResult(trimmedText), 0);
				} else {
					onTranscriptionResult(trimmedText);
				}
			} catch (error) {
				setHint(`Error in onTranscriptionResult callback:: ${error}`);
				setTimeout(() => setHint(null), HINT_AUTO_DISMISS_MS);
				console.error('Error in onTranscriptionResult callback:', error);
			}
		} catch (error) {
			console.error('Error transcribing audio:', error);
			const errorMessage = `Transcription error: ${error instanceof Error ? error.message : 'Unknown error'}`;
			setRecordingError(errorMessage);
			onError?.(errorMessage);
		} finally {
			setIsTranscribing(false);
		}
	};

	const wireSimplifiedRecorder = (recorder: MediaRecorder, mimeType: string) => {
		const chunks: Blob[] = [];

		recorder.ondataavailable = (event) => {
			if (event.data.size > 0) chunks.push(event.data);
		};

		recorder.onstop = async () => {
			if (chunks.length > 0) {
				await transcribeAudio(new Blob(chunks, { type: resolveBlobMimeType(mimeType) }));
			}
			cleanupStream();
		};

		recorder.start();
		setTimeout(() => {
			if (mediaRecorderRef.current?.state === 'recording') {
				mediaRecorderRef.current.stop();
			}
		}, SIMPLIFIED_MAX_RECORDING_MS);
	};

	const wireAdvancedRecorder = (recorder: MediaRecorder, mimeType: string) => {
		chunksRef.current = [];
		pendingSilenceChunksRef.current = [];

		recorder.ondataavailable = (event) => {
			if (!event.data || event.data.size === 0) return;

			if (isCurrentlySilentRef.current) {
				pendingSilenceChunksRef.current.push(event.data);
				const maxChunks = Math.ceil(MAX_KEPT_SILENCE_MS / RECORDING_TIMESLICE_MS);

				if (pendingSilenceChunksRef.current.length > maxChunks) {
					pendingSilenceChunksRef.current.splice(0, pendingSilenceChunksRef.current.length - maxChunks);
				}
			} else {
				chunksRef.current.push(event.data);
			}

			if (Date.now() - recordingStartTimeRef.current > SAFETY_MAX_RECORDING_MS) {
				stopRecording(true);
			}
		};

		recorder.onstop = async () => {
			if (pendingSilenceChunksRef.current.length) {
				chunksRef.current.push(...pendingSilenceChunksRef.current);
				pendingSilenceChunksRef.current = [];
			}

			const finalChunks = chunksRef.current.slice();
			chunksRef.current = [];
			cleanupDetector();

			if (finalChunks.length > 0) {
				await transcribeAudio(new Blob(finalChunks, { type: resolveBlobMimeType(mimeType) }));
			}

			cleanupStream();
		};

		recorder.start(RECORDING_TIMESLICE_MS);
	};

	const startRecording = async (forceSimplified = false) => {
		try {
			setRecordingError(null);

			if (!navigator.mediaDevices?.getUserMedia) {
				throw new Error('getUserMedia is not supported in this environment');
			}

			if (!window.MediaRecorder) {
				throw new Error('MediaRecorder is not supported in this browser');
			}

			const useSimplified = forceSimplified || (isIOSSafari() && isPWA());
			const stream = await navigator.mediaDevices.getUserMedia({ audio: buildAudioConstraints(useSimplified) });
			streamRef.current = stream;

			if (!useSimplified) {
				detectorRef.current = startSilenceDetector(stream, {
					onSpeechResume: () => {
						isCurrentlySilentRef.current = false;
						if (pendingSilenceChunksRef.current.length) {
							chunksRef.current.push(...pendingSilenceChunksRef.current);
							pendingSilenceChunksRef.current = [];
						}
					},
					onSilenceStart: () => {
						isCurrentlySilentRef.current = true;
					},
					onInactivityTimeout: () => {
						Promise.resolve().then(() => stopRecording(true));
					},
				});
			}

			const mimeType = pickMimeType();
			let recorder: MediaRecorder;

			try {
				recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
			} catch {
				recorder = new MediaRecorder(stream);
			}

			recorder.onerror = (event) => {
				console.error('MediaRecorder error:', event);
				setIsRecording(false);
				setRecordingError(RECORDING_FAILED_HINT);
				setHint(RECORDING_FAILED_HINT);
				setTimeout(() => setHint(null), HINT_AUTO_DISMISS_MS);

				if (!useSimplified) cleanupDetector();
			};

			mediaRecorderRef.current = recorder;

			if (useSimplified) {
				wireSimplifiedRecorder(recorder, mimeType);
			} else {
				wireAdvancedRecorder(recorder, mimeType);
			}

			recordingStartTimeRef.current = Date.now();
			setIsRecording(true);
			setHint(RECORDING_HINT);
		} catch (error) {
			console.error('Error starting recording:', error);
			setRecordingError(`Recording failed: ${error}`);

			if (!forceSimplified) cleanupDetector();

			throw error;
		}
	};

	const handleMicClick = async () => {
		if (isRecording) {
			stopRecording();
			setHint(null);
			return;
		}

		if (isPWA()) {
			try {
				const AudioContextClass = getAudioContextClass();
				const tempCtx = new AudioContextClass();

				if (tempCtx.state === 'suspended') {
					await tempCtx.resume();
				}

				await tempCtx.close();
			} catch {}
		}

		try {
			await startRecording();
		} catch (error) {
			console.error('Primary recording failed:', error);

			try {
				await startRecording(true);
			} catch (fallbackError) {
				console.error('Simplified recording also failed:', fallbackError);
				const errorMessage = `Recording failed: ${fallbackError || 'Unknown error'}`;
				setRecordingError(errorMessage);
				onError?.(errorMessage);
			}
		}
	};

	useEffect(() => {
		return () => {
			if (isRecording) stopRecording();
			cleanupDetector();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<>
			{hint && (
				<div style={{
					position: 'absolute',
					bottom: '100%',
					left: '50%',
					transform: 'translateX(-50%)',
					backgroundColor: 'rgba(0, 0, 0, 0.8)',
					color: 'white',
					padding: '8px 16px',
					borderRadius: '8px',
					fontSize: '14px',
					whiteSpace: 'nowrap',
					zIndex: 1000,
					marginBottom: '8px',
				}}>
					{hint}
				</div>
			)}
			<IconButton
				onClick={handleMicClick}
				disabled={disabled || isTranscribing}
				color={isRecording ? 'error' : recordingError ? 'warning' : 'default'}
				title={recordingError || (isRecording ? 'Stop recording' : 'Start recording')}
			>
				{isRecording ? (
					<MicOffIcon sx={{ height: MIC_ICON_SIZE, width: MIC_ICON_SIZE }} />
				) : (
					<MicIcon sx={{
						height: MIC_ICON_SIZE,
						width: MIC_ICON_SIZE,
						opacity: isTranscribing ? 0.5 : 1,
						color: recordingError ? 'orange' : theme.palette.text.secondary,
					}} />
				)}
			</IconButton>
		</>
	);
};

export default AudioRecorder;

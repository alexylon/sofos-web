import {
	FFT_SIZE,
	INACTIVITY_STOP_MS,
	PWA_RESUME_RETRY_MS,
	SILENCE_THRESHOLD,
	TARGET_SAMPLE_RATE_HZ,
} from '@/components/utils/constants';
import { getAudioContextClass, isIOSSafari, isPWA } from '@/components/utils/platform';

const PCM_BYTE_CENTER = 128;
const PCM_BYTE_RANGE = 128;

export interface SilenceDetectorCallbacks {
	onSpeechResume: () => void;
	onSilenceStart: () => void;
	onInactivityTimeout: () => void;
}

export interface SilenceDetector {
	close: () => void;
}

const resumeContext = (audioCtx: AudioContext) => {
	const tryResume = async () => {
		try {
			await audioCtx.resume();
		} catch (error) {
			console.error('Failed to resume AudioContext:', error);
		}
	};

	if (isPWA()) {
		void tryResume();
		PWA_RESUME_RETRY_MS.forEach(delay => setTimeout(tryResume, delay));
	} else {
		void tryResume();
	}
};

export const startSilenceDetector = (
	stream: MediaStream,
	callbacks: SilenceDetectorCallbacks,
): SilenceDetector => {
	const AudioContextClass = getAudioContextClass();
	const audioCtx = new AudioContextClass(
		isPWA() ? {} : { sampleRate: TARGET_SAMPLE_RATE_HZ },
	);

	if (audioCtx.state === 'suspended') {
		resumeContext(audioCtx);
	}

	const source = audioCtx.createMediaStreamSource(stream);
	const analyser = audioCtx.createAnalyser();
	analyser.fftSize = FFT_SIZE;
	source.connect(analyser);

	const data = new Uint8Array(analyser.frequencyBinCount);

	let lastSoundTime = Date.now();
	let isCurrentlySilent = true;
	let rafId: number | null = null;

	const loop = () => {
		analyser.getByteTimeDomainData(data);

		let sumSquares = 0;
		for (let i = 0; i < data.length; i++) {
			const v = (data[i] - PCM_BYTE_CENTER) / PCM_BYTE_RANGE;
			sumSquares += v * v;
		}

		const rms = Math.sqrt(sumSquares / data.length);
		const now = Date.now();

		if (rms > SILENCE_THRESHOLD) {
			lastSoundTime = now;

			if (isCurrentlySilent) {
				isCurrentlySilent = false;
				callbacks.onSpeechResume();
			}
		} else {
			if (!isCurrentlySilent) {
				isCurrentlySilent = true;
				callbacks.onSilenceStart();
			}

			if (now - lastSoundTime >= INACTIVITY_STOP_MS && !isIOSSafari() && !isPWA()) {
				callbacks.onInactivityTimeout();
			}
		}

		rafId = requestAnimationFrame(loop);
	};

	rafId = requestAnimationFrame(loop);

	return {
		close: () => {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}

			try {
				audioCtx.close();
			} catch {}
		},
	};
};

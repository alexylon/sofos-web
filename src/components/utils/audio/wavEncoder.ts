import { TARGET_SAMPLE_RATE_HZ } from '@/components/utils/constants';
import { getAudioContextClass } from '@/components/utils/platform';

const INT16_MAX_NEG = 0x8000;
const INT16_MAX_POS = 0x7FFF;
const WAV_HEADER_BYTES = 44;
const WAV_BYTES_PER_SAMPLE = 2;
const PCM_FORMAT = 1;
const BITS_PER_SAMPLE = 16;

const writeString = (view: DataView, offset: number, str: string) => {
	for (let i = 0; i < str.length; i++) {
		view.setUint8(offset + i, str.charCodeAt(i));
	}
};

const createWavFile = (samples: Int16Array, sampleRate: number, numChannels: number): ArrayBuffer => {
	const dataSize = samples.length * WAV_BYTES_PER_SAMPLE;
	const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataSize);
	const view = new DataView(buffer);

	writeString(view, 0, 'RIFF');
	view.setUint32(4, 36 + dataSize, true);
	writeString(view, 8, 'WAVE');
	writeString(view, 12, 'fmt ');
	view.setUint32(16, 16, true);
	view.setUint16(20, PCM_FORMAT, true);
	view.setUint16(22, numChannels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * numChannels * WAV_BYTES_PER_SAMPLE, true);
	view.setUint16(32, numChannels * WAV_BYTES_PER_SAMPLE, true);
	view.setUint16(34, BITS_PER_SAMPLE, true);
	writeString(view, 36, 'data');
	view.setUint32(40, dataSize, true);

	for (let i = 0; i < samples.length; i++) {
		view.setInt16(WAV_HEADER_BYTES + i * WAV_BYTES_PER_SAMPLE, samples[i], true);
	}

	return buffer;
};

const resampleLinear = (channelData: Float32Array, sourceRate: number, targetRate: number): Float32Array => {
	if (sourceRate === targetRate) return channelData;

	const ratio = sourceRate / targetRate;
	const newLength = Math.round(channelData.length / ratio);
	const samples = new Float32Array(newLength);

	for (let i = 0; i < newLength; i++) {
		const srcIndex = i * ratio;
		const srcIndexFloor = Math.floor(srcIndex);
		const srcIndexCeil = Math.min(srcIndexFloor + 1, channelData.length - 1);
		const fraction = srcIndex - srcIndexFloor;
		samples[i] = channelData[srcIndexFloor] * (1 - fraction) + channelData[srcIndexCeil] * fraction;
	}

	return samples;
};

const float32ToInt16 = (samples: Float32Array): Int16Array => {
	const int16Samples = new Int16Array(samples.length);
	for (let i = 0; i < samples.length; i++) {
		const s = Math.max(-1, Math.min(1, samples[i]));
		int16Samples[i] = s < 0 ? s * INT16_MAX_NEG : s * INT16_MAX_POS;
	}
	return int16Samples;
};

export const convertToWav = async (audioBlob: Blob): Promise<Blob> => {
	const arrayBuffer = await audioBlob.arrayBuffer();
	const AudioContextClass = getAudioContextClass();
	const audioContext = new AudioContextClass();
	const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

	const channelData = audioBuffer.getChannelData(0);
	const resampled = resampleLinear(channelData, audioBuffer.sampleRate, TARGET_SAMPLE_RATE_HZ);
	const int16Samples = float32ToInt16(resampled);
	const wavBuffer = createWavFile(int16Samples, TARGET_SAMPLE_RATE_HZ, 1);

	return new Blob([wavBuffer], { type: 'audio/wav' });
};

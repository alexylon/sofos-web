type WebkitWindow = typeof window & {
	webkitAudioContext?: typeof AudioContext;
};

type StandaloneNavigator = typeof navigator & {
	standalone?: boolean;
};

export const isIOSSafari = (): boolean => {
	if (typeof navigator === 'undefined') return false;
	return /iPad|iPhone|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent);
};

export const isPWA = (): boolean => {
	if (typeof window === 'undefined') return false;
	return window.matchMedia('(display-mode: standalone)').matches
		|| (window.navigator as StandaloneNavigator).standalone === true;
};

export const getAudioContextClass = (): typeof AudioContext => {
	const w = window as WebkitWindow;
	const ctor = w.AudioContext ?? w.webkitAudioContext;

	if (!ctor) {
		throw new Error('AudioContext is not supported in this environment.');
	}

	return ctor;
};

/// <reference types="vite/client" />

declare global {
	interface Window {
		umami?: {
			track: (eventName: string, eventData?: Record<string, unknown>) => void;
			identify?: (userId: string, userData?: Record<string, unknown>) => void;
		};
	}
}

export {};

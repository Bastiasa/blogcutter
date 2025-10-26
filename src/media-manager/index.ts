import { registerPlugin } from '@capacitor/core';

type PickVideoCallbackData = {
    type: 0;
    progress: number;
} | {
    type: 1;
    chunk: string;
    totalSize: number;
} | {
    type: 2;
    success: true;
    fileName: string;
    filePath: string;
} | {
    type: 2;
    success: false
}

export interface MediaManager {
    pickVideoFile(callback: (data: PickVideoCallbackData) => void): Promise<void>;
}

export const MediaManager = registerPlugin<MediaManager>('MediaManager');

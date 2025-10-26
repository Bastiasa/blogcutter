import { registerPlugin } from '@capacitor/core';

type PickVideoCallbackData = {
    type: 0;
    progress: number;
} | {
    type: 1;
    success: true;
    fileName: string;
    filePath: string;
    width: number;
    height: number;
    size: number;
} | {
    type: 1;
    success: false
}



export interface MediaManager {
    pickVideoFile(callback: (data: PickVideoCallbackData) => void): Promise<void>;
    pickFolder(): Promise<void>;
    makeTrim(args: { start: number, end: number }): Promise<{ code: number }>;
}

export const MediaManager = registerPlugin<MediaManager>('MediaManager');

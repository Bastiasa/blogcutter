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

type TrimVideoReturnType = {
    code: 0 | 1 | 2 | 3;
} | {
    code: 4;
    uri: string;
}



export interface MediaManager {
    pickVideoFile(callback: (data: PickVideoCallbackData) => void): Promise<void>;
    pickFolder(): Promise<void>;
    makeTrim(args: { start: number, end: number }): Promise<TrimVideoReturnType>;
    openVideo(args: { uri: string }): Promise<void>;
}

export const MediaManager = registerPlugin<MediaManager>('MediaManager');

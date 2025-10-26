// import { MediaPlugin } from '@/android-media-plugin/plugin';
import { Capacitor } from '@capacitor/core';
import { FFmpeg as WebFFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { VideoEditor } from '@whiteguru/capacitor-plugin-video-editor';

const webFFmpeg = new WebFFmpeg();

VideoEditor.addListener('transcodeProgress', e => {
    console.log("Transcoding... ", e.progress);
});

function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {

    const chars = atob(base64);
    const bytes = new Uint8Array(chars.length);

    for (let i = 0; i < bytes.length; i += chars.length) {
        bytes[i] = chars.charCodeAt(i);
    }

    return bytes;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000; // 32 KB aprox.

    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
}

// async function _optimizeInAndroid(videoFile: File) {

//     // Saving the file...

//     const buffer = await videoFile.arrayBuffer();
//     const b64Data = arrayBufferToBase64(buffer);

//     const fileExtension = videoFile.type.split('/').pop() as string;
//     const androidFileName = `input.${fileExtension}`;

//     const optimizedVideoData = await MediaPlugin.optimizeVideo({
//         fileData: b64Data,
//         fileName: androidFileName
//     });

//     if (optimizedVideoData.success) {
//         const byteCharacters = atob(optimizedVideoData.result);
//         const optimizedVideoBuffer = new Uint8Array(byteCharacters.length);

//         for (let i = 0; i < optimizedVideoBuffer.length; i++) {
//             optimizedVideoBuffer[i] = byteCharacters.charCodeAt(i);
//         }

//         return new File(
//             [optimizedVideoBuffer],
//             `${videoFile.name.substring(0, videoFile.name.length - fileExtension.length)}`,
//             { type: 'video/mp4' }
//         );
//     }

//     return null;
// }

async function _optimizeInWeb(videoFile: File) {


    const buffer = await videoFile.arrayBuffer();
    const base64Video = arrayBufferToBase64(buffer);

    const { uri: videoUri } = await Filesystem.writeFile({
        data: base64Video,
        path: videoFile.name,
        directory: Directory.Cache
    });

    const result = await VideoEditor.edit({
        path: videoUri,

        transcode: {
            fps: 30,
            width: 1280,
            keepAspectRatio: true
        }
    });

    console.log("Video transcoded. URI: ", result.file.path);

    let optimizedVideoBuffer = new Uint8Array();

    await new Promise<void>(async resolve => {

        await Filesystem.readFileInChunks({
            chunkSize: 1024,
            directory: Directory.Cache,
            path: result.file.name
        }, async (chunkResult) => {

            const chunk = chunkResult?.data;

            if (chunk instanceof Blob) {
                const chunkBuffer = new Uint8Array(await chunk.arrayBuffer());

                optimizedVideoBuffer = new Uint8Array([
                    ...optimizedVideoBuffer,
                    ...chunkBuffer
                ]);
            } else if (typeof chunk == 'string') {
                const chunkBuffer = base64ToUint8Array(chunk);

                optimizedVideoBuffer = new Uint8Array([
                    ...optimizedVideoBuffer,
                    ...chunkBuffer
                ]);
            }
        });

        resolve();
    });

    return new File(
        [
            optimizedVideoBuffer
        ],
        result.file.name,
        {
            type: result.file.type
        }
    );

    // if (!webFFmpeg.loaded) {

    //     webFFmpeg.on('progress', e => {
    //         console.log(e);
    //     });

    //     webFFmpeg.on('log', e => {
    //         console.log(e.message);
    //     });

    //     // await webFFmpeg.load();

    //     await webFFmpeg.load({
    //         coreURL: await toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript'),
    //         // workerURL: await toBlobURL('/ffmpeg/ffmpeg-core.worker.js', 'text/javascript'),
    //         wasmURL: await toBlobURL('/ffmpeg/ffmpeg-core.wasm', 'application/wasm')
    //     });
    // }


    // await webFFmpeg.writeFile(
    //     videoFile.name,
    //     await fetchFile(videoFile)
    // );

    // await webFFmpeg.exec([
    //     '-y', '-i', videoFile.name,
    //     '-vf', 'scale=1280:-1',
    //     '-b:v', '600k',
    //     'result.mp4'
    // ]);

    // const fileNameExtension = videoFile.name.split('.').pop() as string;
    // const resultData = await webFFmpeg.readFile('result.mp4', 'binary') as Uint8Array<ArrayBuffer>;

    // return new File([resultData], `${videoFile.name.substring(0, videoFile.name.length - fileNameExtension.length - 1)}`);
}

export async function generateOptimizedVideo(videoFile: File): Promise<File | null> {

    try {
        switch (Capacitor.getPlatform() as 'android' | 'web' | 'ios') {
            case 'android': return await _optimizeInWeb(videoFile);
            case 'web': return await _optimizeInWeb(videoFile);
        };

    } catch (error) {
        console.log("Error trying to optimize video: ", error);
    }

    return null;

}
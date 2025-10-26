import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { generateOptimizedVideo } from "./lib/mediaManager";

type SetVideoReturnType = boolean;

export interface VideoContextMap {

    readonly videoName?: string;
    readonly videoUrl?: string;
    readonly videoMetadata: {
        width: number;
        height: number;
        size: number;
    }|undefined;
    
    readonly playing: boolean;
    readonly duration: number;
    readonly fullscreen: boolean;
    readonly cuttingRange: [number, number];

    readonly doneCuts: [startTime: number, endTime: number, status: 'trimming'|'done'|'failed'][];

    currentTime: number;

    trimStart: number;
    trimEnd: number;


    readonly setVideo: (video: string, videoName?:string, videoMetadata?:VideoContextMap["videoMetadata"]) => Promise<SetVideoReturnType>;
    readonly play: () => void;
    readonly pause: () => void;

    readonly setFullscreen: (enabled: boolean) => void;

    readonly isCutting: () => boolean;
    readonly setCuttingRange: (cuttingRange: VideoContextMap['cuttingRange']) => void;

}

function clamp(value:number, min:number, max:number) {
    return Math.min(
    max,
    Math.max(value, min)
    );
}

const VideContext = createContext<VideoContextMap|null>(null);

export function VideoContextProvider({children}:{children:ReactNode}) {


    const [videoName, setVideoName] = useState<string | undefined>(undefined);
    const [videoUrl, setVideoUrl] = useState<string | undefined>(undefined);
    const [videoMetadata, setVideoMetadata] = useState<VideoContextMap["videoMetadata"]>(undefined);
    const [playing, setPlaying] = useState(false);
    const [duration, setDuration] = useState(NaN);
    const [fullscreen, setFullscreen] = useState(false);
    const [doneCuts, setDoneCuts] = useState<VideoContextMap['doneCuts']>([]);
    const [cuttingRange, setCuttingRange] = useState<VideoContextMap['cuttingRange']>([NaN, NaN]);

    const currentTimeRef = useRef(0);
    const trimStartRef = useRef(0);
    const trimEndRef = useRef(0);

    function setTrimStart(value:number) {
        trimStartRef.current = clamp(value, 0, (trimEndRef.current));
    }

    function setTrimEnd(value:number) {
        trimEndRef.current = clamp(value, trimStartRef.current, 1);
    }


    async function setVideo(
        videoSrc: string,
        videoName: string = "Unknown",
        metadata?: VideoContextMap["videoMetadata"]): ReturnType<VideoContextMap['setVideo']> { 

        try {

            await new Promise<void>(async (resolve, reject) => {
                const videoElement = document.createElement('video');
                
                const response = await fetch(videoSrc);
                const responseBlob = await response.blob();
                
                
                videoElement.addEventListener('loadedmetadata', async (e) => {
                    console.log(e);
                    
                    setDuration(videoElement.duration);
                    console.log(`Video size: ${videoElement.videoWidth}, ${videoElement.videoHeight}`);

                    if (metadata) {
                        setVideoMetadata(metadata);
                    } else {
                        setVideoMetadata({
                            width:videoElement.videoWidth,
                            height: videoElement.videoHeight,
                            size: responseBlob.size
                        });
                    }

                    
                    videoElement.remove();
                    resolve();
                });

                videoElement.addEventListener('error', () => {
                    videoElement.remove();
                    reject();
                });
                    
                videoElement.src = URL.createObjectURL(responseBlob);
                videoElement.style.display = 'none';
                document.body.appendChild(videoElement);
            });
            
            setVideoName(videoName);
            setVideoUrl(videoSrc);
            setPlaying(false);
            currentTimeRef.current = 0;
            setDoneCuts([]);
            setCuttingRange([0, duration]);
            console.log("Process finished");
        } catch (error) {
            console.log("Error trying to load video: ", error);
            return false;
        }



        return true;
    }

    function isCutting() {
        
        for (const cutData of doneCuts) {
            if (!cutData[2]) {
                return true;
            }
        }

        return false;
    }

    const value: VideoContextMap = {
        videoMetadata,
        videoName,
        videoUrl,
        playing,
        duration,
        
        set trimStart(value: number) {
            setTrimStart(value);
        },

        get trimStart() {
            return trimStartRef.current;
        },

        set trimEnd(value: number) {
          setTrimEnd(value)  
        },

        get trimEnd() {
            return trimEndRef.current
        },

        set currentTime(number:number) {
            currentTimeRef.current = number;
        },

        get currentTime() {
            return currentTimeRef.current;
        },

        fullscreen,
        doneCuts,
        cuttingRange,

        setVideo,

        play() {
            setPlaying(true);
        },

        pause() {
            setPlaying(false)
        },

        setFullscreen,

        isCutting,
        setCuttingRange
    };

    return <VideContext.Provider value={value}>
        {children}
    </VideContext.Provider>
}

export function useVideoContext() {
    return useContext(VideContext) as VideoContextMap;
}
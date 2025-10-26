import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { generateOptimizedVideo } from "./lib/mediaManager";

type SetVideoReturnType = boolean;

interface VideoContextMap {

    readonly videoName?: string;
    readonly videoUrl?: string;
    readonly playing: boolean;
    currentTime: number;
    readonly duration: number;
    readonly fullscreen: boolean;
    readonly cuttingRange: [number, number];

    readonly doneCuts: [number, number, boolean][];

    readonly setVideo: (video: string, videoName?:string) => Promise<SetVideoReturnType>;
    readonly play: () => void;
    readonly pause: () => void;

    readonly setFullscreen: (enabled: boolean) => void;

    readonly isCutting: () => boolean;
    readonly setCuttingRange: (cuttingRange: VideoContextMap['cuttingRange']) => void;

}

const VideContext = createContext<VideoContextMap|null>(null);

export function VideoContextProvider({children}:{children:ReactNode}) {


    const [videoName, setVideoName] = useState<string | undefined>(undefined);
    const [videoUrl, setVideoUrl] = useState<string|undefined>(undefined);
    const [playing, setPlaying] = useState(false);
    const [duration, setDuration] = useState(NaN);
    const currentTimeRef = useRef(0);
    const [fullscreen, setFullscreen] = useState(false);
    const [doneCuts, setDoneCuts] = useState<VideoContextMap['doneCuts']>([]);
    const [cuttingRange, setCuttingRange] = useState<VideoContextMap['cuttingRange']>([NaN, NaN]);

    async function setVideo(videoSrc: string, videoName:string = "Unknown"): ReturnType<VideoContextMap['setVideo']> { 

        try {

            await new Promise<void>((resolve, reject) => {
                const videoElement = document.createElement('video');
                
                videoElement.addEventListener('loadedmetadata', (e) => {
                    console.log(e);
                    
                    setDuration(videoElement.duration);
                    console.log(`Video size: ${videoElement.videoWidth}, ${videoElement.videoHeight}`);
                    
                    videoElement.remove();
                    resolve();
                });

                videoElement.addEventListener('error', () => {
                    videoElement.remove();
                    reject();
                });
                    
                videoElement.src = videoSrc;
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
        videoName,
        videoUrl,
        playing,
        duration,

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
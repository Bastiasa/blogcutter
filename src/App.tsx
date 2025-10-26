
import './App.css'

import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";

import { useVideoContext, VideoContextProvider } from './VideoContext';
import { CheckIcon, ExternalLinkIcon, ListCheckIcon, MaximizeIcon, MenuIcon, MinimizeIcon, PauseIcon, PlayIcon, RedoIcon, ScissorsIcon, TriangleIcon, UndoIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from './components/ui/button';
import { Spinner } from './components/ui/spinner';
import { useEffect, useRef, useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from './components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './components/ui/alert-dialog';
import { Slider } from './components/ui/slider';
import { MediaManager } from './media-manager';
import { Progress } from './components/ui/progress';

import { Capacitor } from '@capacitor/core';

type CapacitorPlatform = 'android' | 'web'|'ios';

function formatTime(seconds:number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
  } else {
    return [m, s].map(v => v.toString().padStart(2, '0')).join(':');
  }
}

function TaskUI() {


  const { doneCuts, isCutting } = useVideoContext();



  

  return (

    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button  
          disabled={doneCuts.length <= 0}
          variant={'ghost'}>
          
          {isCutting() ? <Spinner /> :
            (doneCuts.length > 0 ? <ListCheckIcon /> : undefined)}
        </Button>
      </DropdownMenuTrigger>


      <DropdownMenuContent>
        <DropdownMenuGroup>
          {doneCuts.map((cutData, i) => {
            return <DropdownMenuItem
              key={i}
              className='hover:bg-popover! hbox w-screen max-w-[256px] gap-2 pointer-events-auto'>
              
              <div className='grow min-w-0'>
                <span className='opacity-60'>{i+1}.</span> <span>{formatTime(cutData[0])}</span> - <span>{formatTime(cutData[1])}</span>
              </div>

              <Button
                disabled={!cutData[2]}
                variant={'ghost'}>
                <ExternalLinkIcon />
              </Button>
              {cutData[2] ? <CheckIcon /> : <Spinner />}              

            </DropdownMenuItem>
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuButton() {

  type OptionCommand = 'openvideo'|'selectfolder'

  const OPTIONS: ([string, OptionCommand])[] = [
    ["Open video", "openvideo"],
    ["Select Ouput Folder", "selectfolder"]
  ];


  const { setVideo, isCutting } = useVideoContext();

  type AlertData = { open: false } | { open: true; title: string; text: string; onAccept?: () => void; onCancel?: () => void, acceptText?:string, cancelText?:string };
  type LoadingData = {
    enabled:false
  } | {
    enabled: true;
    progress?: number
  }

  const [loadingData, setLoadingData] = useState<LoadingData>({enabled:false});
  const [alertData, setAlertData] = useState<AlertData>({open:false});
  const [sheetOpen, setSheetOpen] = useState(false);

  function openVideoInAndroid() {
    const optimizedVideoBuffer: number[] = [];

    MediaManager.pickVideoFile(async (data) => {
      switch (data.type) {
        case 0:

          setLoadingData(v =>({
            enabled: true,
            progress: data.progress * 100
          }));
          
          break;
        
        case 1:

          const decodedChunk = atob(data.chunk);
          for (const character of decodedChunk) {
            optimizedVideoBuffer.push(character.charCodeAt(0));
            setLoadingData(v => ({
              enabled: true,
              progress: optimizedVideoBuffer.length / data.totalSize * 100
            }));
          }
          
          break;
        
        case 2:

          let successSettingVideo = false;

          setLoadingData({
            enabled: true,
            progress:1
          });

          if (data.success) {

            const videoFile = new File(
              [new Uint8Array(optimizedVideoBuffer)],
              data.fileName,
              {type:"video/mp4"}
            )

            successSettingVideo = await setVideo(videoFile);
            setSheetOpen(false);
          }

          setLoadingData({
            enabled: false
          });
          
          if (!successSettingVideo) {
            setAlertData({
              open: true,
              title: "Error",
              text:"Something went wrong with this file."
            });
          } 
          break;
      }
    });
  }

  function openVideoInWeb() {
    const inputElement = document.createElement('input');

    inputElement.type = 'file';
    inputElement.accept = 'video/*';
    inputElement.multiple = false;
    inputElement.style.display = 'none';

    inputElement.addEventListener('input', () => { 
      setSheetOpen(false);
      inputElement.remove();

      if (!inputElement.files || inputElement.files.length <= 0) {
        return;
      }
      const videoFile = inputElement.files[0];
      setVideo(videoFile)
        .then(success => {
          setLoadingData({ enabled: false });
          if (!success) {
            setAlertData({
              open: true,
              title: "Error!",
              text: "Something went wrong with this video file.",
              onAccept() { },
              acceptText: "Ok"
            });

          }
        });
      
      setLoadingData({ enabled: true });
    });

    document.body.appendChild(inputElement);
    inputElement.click();
  }

  function onOpenVideoPressed(ignoreWarning:boolean = false) {

    if (isCutting() && !ignoreWarning) {
      setAlertData({
        open: true,
        title: "Warning!",
        text: "Some processes are still running. Doing this will cause them to be canceled. Are you sure you want to continue?",
        onAccept() {
          onOpenVideoPressed(true);
        }
      });

      return;
    }

    setLoadingData({
      enabled: true
    });

    const PLATFORM = Capacitor.getPlatform() as CapacitorPlatform;

    switch (PLATFORM) {
      case 'android':
        openVideoInAndroid();
        break;
      
      case 'web':
        openVideoInWeb();
        break;
      
      case 'ios':
        console.warn("Not implemented: Open video in web.");
        
        break;
    }


    
  }

  function onOptionPressed(option: OptionCommand) {
    if (option == 'openvideo') {
      onOpenVideoPressed();
    }
  }


  return (
    <>
      
      <Sheet
        open={sheetOpen}>
      <SheetTrigger asChild>
          <Button
            onClick={()=>setSheetOpen(true)}
            variant="ghost">
            <MenuIcon />
          </Button>
      </SheetTrigger>

      <SheetContent className={`${loadingData.enabled ? "hidden" : ""} py-12`}>
        <SheetHeader>
          <SheetTitle>Options</SheetTitle>
          <SheetHeader>
            <div className="vbox">
              {OPTIONS.map((v, i) => {
                return <button
                  onPointerUp={()=>onOptionPressed(v[1])}
                  className='hover:bg-secondary transition-colors px-2 text-left w-full py-4'
                  key={i}>
                  {v[0]}
                </button>
              })}
            </div>
          </SheetHeader>
        </SheetHeader>
      </SheetContent>
    </Sheet>
      
    <AlertDialog
      open={alertData.open}>
      
      <AlertDialogContent>
        {alertData.open &&
        
          <>

            <AlertDialogHeader>
              <AlertDialogTitle>{alertData.title}</AlertDialogTitle>
              <AlertDialogDescription>{alertData.text}</AlertDialogDescription>
            </AlertDialogHeader>
            
            <AlertDialogFooter>
              {alertData.onCancel !== undefined && 
                
                <AlertDialogCancel
                  onPointerUp={() => {
                    alertData.onCancel?.();
                    setAlertData({ open: false })
                  }}>
                  {alertData.cancelText ?? "No"}
                </AlertDialogCancel>
              }
              
              {alertData.onAccept !== undefined &&
              
                <AlertDialogAction
                  onPointerUp={() => {
                    alertData.onAccept?.();
                    setAlertData({ open: false })
                  }}>
                  {alertData.acceptText ?? "Yes"}
                </AlertDialogAction>
              }
              
            </AlertDialogFooter>
          
          </>
        
        }
      </AlertDialogContent>
      
      </AlertDialog>
      

    {loadingData.enabled && <div className="fixed px-12 z-50 inset-0 bg-secondary vbox justify-center items-center">
        {(loadingData.progress == undefined || !isFinite(loadingData.progress)) && <Spinner/>}
        
        {isFinite(loadingData.progress ?? NaN) &&
          <Progress
            value={loadingData.progress}
            className='w-full'/>}
    </div>}
    
    </>
  )
}

function VideoPreview() {

  const videoContext = useVideoContext();
  const {
    videoUrl,
    playing,
    play,
    pause,
    fullscreen,
    duration,
    setFullscreen
  } = videoContext;

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wasPlayingRef = useRef(false);

  const [currentTimeState, setCurrentTimeState] = useState(0);

  useEffect(() => { 
    
    if (fullscreen) {
      containerRef.current?.requestFullscreen();
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen();      
      }
    }

  }, [fullscreen]);

  useEffect(() => {
    
    if (playing) {
      videoRef.current?.play();
    } else {
      videoRef.current?.pause();
    }


    let syncId = -1;

    const syncCurrentTime = () => {
      syncId = requestAnimationFrame(syncCurrentTime);

      if (!playing && videoRef.current) {
        videoRef.current.currentTime = videoContext.currentTime;
      } else if (playing && videoRef.current) {
        videoContext.currentTime = videoRef.current.currentTime;
      }

      if (Math.abs(currentTimeState - videoContext.currentTime) >= 0.05) {
        setCurrentTimeState(videoContext.currentTime);
      }
    }

    syncCurrentTime();


    return () => {
      cancelAnimationFrame(syncId);
    }
  }, [playing, currentTimeState]);

  useEffect(() => {

    const onTimeUpdate = () => {
      //videoContext.currentTime = videoRef.current?.currentTime ?? NaN;
    };

    function onVideoPaused() {
      pause();
    };

    videoRef.current?.addEventListener('timeupdate', onTimeUpdate);
    videoRef.current?.addEventListener('pause', onVideoPaused);

    return () => {
      videoRef.current?.removeEventListener('timeupdate', onTimeUpdate);
      videoRef.current?.removeEventListener('pause', onVideoPaused);
    }

  }, []);

  function onSliderPointerDown() {
    wasPlayingRef.current = playing;
    pause();
  }

  function onSliderPointerUp() {
    if (wasPlayingRef.current) {
      play();
    }
  }

  function onValueChange(v:[number]) {
    videoContext.currentTime = v[0];
  }

  return (

    <div
      ref={containerRef}
      className='bg-black pt-4 w-full h-1 grow contain-content relative'>
      <video
        preload='auto'
        className='size-full object-contain'
        ref={videoRef}
        src={videoUrl}/>
      
      {fullscreen &&
        
        <div className='items-center justify-center min-w-0 hbox gap-4 absolute bottom-12 right-4 left-4'>

          <Button
            variant={'ghost'}
            onClick={() => {
              if (playing)
                pause()
              else
                play()
            }}>
            {playing ? <PauseIcon fill='white'/> : <PlayIcon fill='white'/>}
          </Button>

          <Slider
              onValueCommit={onSliderPointerUp}
              onValueChange={onValueChange}
              onPointerDown={onSliderPointerDown}
              onPointerUp={onSliderPointerUp}
              step={0.01}
              value={[currentTimeState]}
              min={0}
              max={duration}
              className='grow' />
            
          <span className='text-xs text-nowrap'>{formatTime(currentTimeState)} / {formatTime(duration)}</span>
          
          <Button
            onClick={()=>setFullscreen(false)}
            variant={'ghost'}
            className=''>
            <MinimizeIcon />
          </Button>
        </div>
}
    </div>

  );
}

function Controls() {

  const { fullscreen, setFullscreen, play, pause, playing, videoUrl } = useVideoContext();

  function onPlaybackSwitchClicked() {
    if (playing) {
      pause();
    } else {
      play();
    }
  }

  function onFullscreenSwitchClicked() {
    setFullscreen(!fullscreen);
  }

  
  return <>
    <Button
      disabled={!videoUrl}
      variant={'ghost'}>
      <UndoIcon />  
    </Button>
    
    <Button
      variant={'ghost'}
      onPointerUp={onPlaybackSwitchClicked}
      disabled={!videoUrl}>
      {playing ? <PauseIcon fill='white'/> : <PlayIcon fill='white'/>}
    </Button>

    <Button
      disabled={!videoUrl}
      variant={'ghost'}>
      <RedoIcon />
    </Button>
    
    <Button
      disabled={!videoUrl}
      className='absolute right-4'
      variant={'ghost'}
      onPointerUp={onFullscreenSwitchClicked}>
      <MaximizeIcon fill='white'/>
    </Button>
  </>
}

function Timeline() {

  const videoContext = useVideoContext();

  const {
    videoUrl,
    playing,
    duration,
    pause,
    play
  } = videoContext;

  const MAX_ZOOM = 5;
  const MIN_ZOOM = 0.1;
  const SECOND_WIDTH = 24;
  const FRAME_MIN_WIDTH = 100;

  const framesCanvasRef = useRef<HTMLCanvasElement>(null);
  const timelinePadRef = useRef<HTMLDivElement>(null);


  type PointerInfo = {id:number, startX:number, startY:number, x:number, y:number}
  const pointersRef = useRef<PointerInfo[]>([]);
  const pinchZoomStartRef = useRef(NaN);
  const wasPlayingRef = useRef<boolean>(playing);

  const displacementRef = useRef(0);
  const timelineZoomRef = useRef(1);
  const zoomJustChanged = useRef(false);

  function setDisplacement(displacement: number) {
    displacementRef.current = displacement;
  }

  function getElements() {
    return {
      framesCanvas: framesCanvasRef.current as HTMLCanvasElement,
      timelinePad: timelinePadRef.current as HTMLDivElement
    };
  }


  function getPointerData(id:number) {
    return pointersRef.current.find(pInfo => pInfo.id == id);
  }

  function hasPointer(id:number) {
    return getPointerData(id) !== undefined;
  }

  
  // Load preview frames
  useEffect(() => {
    const { framesCanvas } = getElements();

    if (!videoUrl) {
      framesCanvas.style.display = 'none';
      return;
    } else {
      framesCanvas.style.display = 'unset';
    };

    const videoForRender = document.createElement('video');
    let currentFramesGenerator: AsyncGenerator<undefined, void, void> | null = null;
    let drawingPromise: Promise<void> | null = null;

    document.body.appendChild(videoForRender);
    videoForRender.src = videoUrl ?? '';
    videoForRender.style.display = 'none';

    async function* framesGenerator():AsyncGenerator<undefined, void, void> {
      try {
        function drawImageCover(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, dx = 0, dy = 0, dWidth = ctx.canvas.width, dHeight = ctx.canvas.height) {
          const iw = video.videoWidth;
          const ih = video.videoHeight;
          const ir = iw / ih;
          const dr = dWidth / dHeight;

          let sx, sy, sw, sh;

          if (ir > dr) {
            sh = ih;
            sw = ih * dr;
            sx = (iw - sw) / 2;
            sy = 0;
          } else {
            sw = iw;
            sh = iw / dr;
            sx = 0;
            sy = (ih - sh) / 2;
          }

          ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dWidth, dHeight);
        }


        function drawFrameAt(time: number, x: number, y: number, dw: number, dh: number): Promise<void> {
          return new Promise(resolve => {

            if (videoForRender.readyState < 2) {
              videoForRender.addEventListener('loadeddata', () => drawFrameAt(time, x, y, dw, dh).then(resolve), {once:true});
              return;
            }

            const draw = () => {
              const context = framesCanvas.getContext('2d') as CanvasRenderingContext2D;
              drawImageCover(context, videoForRender, x, y, dw, dh);
              console.log("Frame drew at", time);
              resolve();
            }

            videoForRender.addEventListener('seeked', draw, {once:true});
            videoForRender.currentTime = time;
          });
        };


        const count = Math.floor(framesCanvas.width / FRAME_MIN_WIDTH) + 1;
        const timeStep = duration / count;

        for (let frame = 0; frame < count; frame++) {
            
          await drawFrameAt(
            frame * timeStep,
            frame * FRAME_MIN_WIDTH,
            0,
            FRAME_MIN_WIDTH,
            framesCanvas.height
          );


          yield;
          
        }

        return;
      } catch (error) {
      }
    }

    async function drawFrames() {
      if (currentFramesGenerator) {
        await currentFramesGenerator.return();
        await drawingPromise;
        console.log("Frames drawing cancelled.");
      }

      const generator = framesGenerator();
      currentFramesGenerator = generator;

      drawingPromise = (async () => {
        try {
          for await (const _ of generator) {
          
          }
        } finally {
          currentFramesGenerator = null;
        }
      })();
    }

    function adjustSize() {

      if (!playing) {
        const newCurrentTime = displacementRef.current / framesCanvas.offsetWidth * -1 * duration;
        if (Math.abs(newCurrentTime - videoContext.currentTime) > 0.1) {
          videoContext.currentTime = newCurrentTime;    
        }
      }

      if (zoomJustChanged.current) {
        zoomJustChanged.current = false;

        const canvasWidth = duration * SECOND_WIDTH * timelineZoomRef.current;
        framesCanvas.width = canvasWidth;

        setDisplacement((videoContext.currentTime / duration) * -canvasWidth);
        drawFrames();
      }
    }


    let timelineUpdateId = -1;
    const updateTimeline = () => {
      timelineUpdateId = requestAnimationFrame(updateTimeline);
      adjustSize();
    }

    updateTimeline();
    drawFrames();
    
    return () => {
      cancelAnimationFrame(timelineUpdateId);
      videoForRender.remove();
      currentFramesGenerator?.return();
    }
  }, [videoUrl, duration]);

  // Reset displacement on load video
  useEffect(() => {
    setDisplacement(0);
  }, [videoUrl])

  // Sync displacement with playing video
  useEffect(() => {

    const { framesCanvas, timelinePad } = getElements();
    let onFrameId = -1;

    const onFrame = () => {
      onFrameId = requestAnimationFrame(onFrame);

      if (pointersRef.current.length <= 0) {
        displacementRef.current = ((videoContext.currentTime / duration) * -framesCanvas.offsetWidth);
      }

      framesCanvas.style.left = `${timelinePad.offsetWidth * .5 + displacementRef.current}px`;
    };

    onFrame();

    return () => {
      cancelAnimationFrame(onFrameId);
    }
  }, [playing, duration]);

  // Pointers tracker
  useEffect(() => { 
    const { timelinePad } = getElements();
    

    function onPointerDown(event:PointerEvent) {
      pointersRef.current.push({
        id: event.pointerId,
        startX: event.offsetX,
        startY: event.offsetY,
        x: event.offsetX,
        y: event.offsetY
      });

      if (pointersRef.current.length >= 2) {
        pinchZoomStartRef.current = timelineZoomRef.current;
      }

      wasPlayingRef.current = playing
      pause();
    }

    function onPointerUp(event:PointerEvent) {
      pointersRef.current = pointersRef.current.filter(pInfo => pInfo.id !== event.pointerId);
      
      if (pointersRef.current.length <= 0) {
        if (wasPlayingRef.current) {
          play();
        }
      }
    }

    function onPointerMove(event: PointerEvent) {

      const data = getPointerData(event.pointerId);

      if (data) {
        data.x = event.offsetX;
        data.y = event.offsetY;
      }


    }


    window.addEventListener('pointermove', onPointerMove);
    timelinePad.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('pointerleave', onPointerUp);

    return () => {
      timelinePad.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('pointerleave', onPointerUp);
      window.removeEventListener('pointermove', onPointerMove);
    }
  }, [playing]);


  // Set Displacement
  useEffect(() => {

    const {framesCanvas } = getElements();


    function onPointerMove(e:PointerEvent) {
      if (hasPointer(e.pointerId) && pointersRef.current.length <= 1) {
        e.preventDefault();
        setDisplacement(
          Math.max(
            -framesCanvas.offsetWidth,
            Math.min(displacementRef.current + e.movementX, 0
            ))
        );
      }
    }



    window.addEventListener('pointermove', onPointerMove);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
    }

  }, [playing]);

  // Set zoom
  useEffect(() => {
    const { timelinePad} = getElements();
    
    function onTimelineWheel(e:WheelEvent) {
      const newZoom = Math.max(MIN_ZOOM, timelineZoomRef.current - e.deltaY * .001);
      timelineZoomRef.current = Math.min(newZoom, MAX_ZOOM);
      zoomJustChanged.current = true;
      console.log(newZoom);
    }

    function onWindowPointerMove(event: PointerEvent) {
      if (pointersRef.current.length < 2) {
        // console.log("Not enough pointers.");
        return;
      }

      if (event.pointerId !== pointersRef.current[0].id && event.pointerId !== pointersRef.current[1].id) {
        // console.log("Is not the two first pointers");
        return;
      }

      const [pointer1, pointer2] = pointersRef.current;

      const startDistance = Math.sqrt((pointer1.startX - pointer2.startX) ** 2 + (pointer1.startY - pointer2.startY) ** 2);
      const currentDistance = Math.sqrt((pointer1.x - pointer2.x) ** 2 + (pointer1.y - pointer2.y) ** 2);
      const difference = currentDistance - startDistance;

      //console.log("Pointers difference: ", difference/ window.innerWidth);
      
      const zoom = Math.max(
        MIN_ZOOM,
        Math.min(
          pinchZoomStartRef.current + difference / window.innerWidth,
          MAX_ZOOM
        )
      );

      timelineZoomRef.current = zoom;
      zoomJustChanged.current = true;
    }

    window.addEventListener('pointermove', onWindowPointerMove);
    timelinePad.addEventListener('wheel', onTimelineWheel);

    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      timelinePad.removeEventListener('wheel', onTimelineWheel);
    }
  }, [duration]);


  return (
    <>

      <div
        className='relative py-2 px-4 size-full vbox justify-center'>
        
        <div
          ref={timelinePadRef}
          className='overflow-hidden touch-none rounded-[8px] bg-gray-900 w-full h-[100%] max-h-[200px] relative'>
          
          <canvas
            ref={framesCanvasRef}
            className='touch-none select-none outline-violet-900 outline-[4px] rounded-[8px] absolute left-1/2 -translate-y-1/2 top-1/2 h-[100%] max-h-[100px] bg-blue-300' />
          
        </div>

        <div
          className='bg-blue-500 absolute -translate-x-1/2 left-1/2 h-full w-[3px]'>
          
          <div className='absolute -top-1 left-1/2 -translate-x-1/2 rotate-180'>
            <TriangleIcon
              className='stroke-transparent fill-blue-500'/>
          </div>
        </div>
      </div>
    
    
    </>
  );
}

function _app() {

  const { video } = useVideoContext();


  // useEffect(() => {
  //   (async () => {
  //     const videoFileResponse = await fetch('/hardcoded_video.mp4');
  //     const videoBlob = await videoFileResponse.blob();
  //     const videoFile = new File([videoBlob], 'harcoded_video.mp4', { type: "video/mp4" });
  //     setVideo(videoFile);
  //   })()
  // }, []);

  return (
    <div className="h-screen w-screen vbox py-8 max-w-[600px] mx-auto">

      <div className="hbox h-fit px-5 py-5 gap-4 items-center">
        <span className='grow overflow-hidden text-ellipsis text-nowrap'>{video ? video.name : "..."}</span>
        <TaskUI/>
        <Button>Cut <ScissorsIcon/></Button>
        <MenuButton/>
      </div>
        
      <PanelGroup
        direction="vertical"
        className="grow min-h-0 flex flex-col">
          <Panel defaultSize={70} className="min-h-0 gap-0 vbox overflow-auto">
              <VideoPreview/>
          
              <div
                className='bg-black hbox h-12 gap-4 px-4 justify-center relative items-center'>
                  <Controls/>
              </div>
          </Panel>

          <PanelResizeHandle className="h-1 bg-border/50 cursor-row-resize" />

          <Panel
            defaultSize={50}
            className="min-h-[128px] max-h-[50vh] relative resize-y overflow-auto">
            <Timeline/>
          </Panel>
        </PanelGroup>
    </div>
  );
}

export default function App() {



  return (
    <VideoContextProvider>
      <_app/>
    </VideoContextProvider>
  );
}

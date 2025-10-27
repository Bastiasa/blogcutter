
import './App.css'

import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";

import { useVideoContext, VideoContextProvider, type DoneCut, type VideoContextMap } from './VideoContext';
import { CheckIcon, CircleAlertIcon, ExternalLinkIcon, ListCheckIcon, MaximizeIcon, MenuIcon, MinimizeIcon, PauseIcon, PlayIcon, RedoIcon, ScissorsIcon, TriangleIcon, UndoIcon } from 'lucide-react';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from './components/ui/button';
import { Spinner } from './components/ui/spinner';
import { useEffect, useRef, useState, type Ref, type RefObject } from 'react';
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

function formatSize(size:number) {
  const units = ['bytes', 'KB', 'MB', 'GB'];
  let i = 0;

  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }

  return `${size.toFixed(1)} ${units[i]}`;
}

function clamp(value:number, min:number, max:number) {
  return Math.max(
    min,
    Math.min(
      value,
      max
    )
  );
}

function TaskUI() {

  const { doneCuts, isCutting } = useVideoContext();

  return (

    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button  
          disabled={doneCuts.size <= 0}
          variant={'ghost'}>
          
          {isCutting() ? <Spinner /> :
            (doneCuts.size > 0 ? <ListCheckIcon /> : undefined)}
        </Button>
      </DropdownMenuTrigger>


      <DropdownMenuContent>
        <DropdownMenuGroup>
          {Array.from(doneCuts).map((doneCutDataAndId, index) => {

            const cutId = doneCutDataAndId[0];
            const cutData = doneCutDataAndId[1];

            function onOpenClicked() {
              if (cutData[3]) {
                MediaManager.openVideo({ uri: cutData[3] });
              }
            }

            return <DropdownMenuItem
              key={cutId}
              className='hover:bg-popover! hbox w-screen max-w-[256px] gap-2 pointer-events-auto'>
              
              <div className='grow min-w-0'>
                <span className='opacity-60'>{index+1}.</span> <span>{formatTime(cutData[0])}</span> - <span>{formatTime(cutData[1])}</span>
              </div>

              <Button
                disabled={cutData[2] !== 'done'}
                variant={'ghost'}
                onClick={onOpenClicked}>
                <ExternalLinkIcon />
              </Button>
              {cutData[2] == 'done' ? <CheckIcon /> : (cutData[2] == 'trimming' ? <Spinner /> : <CircleAlertIcon/>)}              

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


  const { setVideo, isCutting, setAlertData } = useVideoContext();


  type LoadingData = {
    enabled:false
  } | {
    enabled: true;
    progress?: number;
    title?: string;
    optionButtons?: [text: string, command: string][];
    onOptionButton?(command: string): void;
  }

  const [loadingData, setLoadingData] = useState<LoadingData>({enabled:false});
  const [sheetOpen, setSheetOpen] = useState(false);

  function openVideoInAndroid() {

    const loadingDataStaticValues: LoadingData = {
      enabled:true,
      title:"Compressing...",

      optionButtons: [
        ["Skip", "skip"],
        ["Cancel", "cancel"]
      ],

      onOptionButton(command) {
          switch (command) {
            case "skip":
              MediaManager.skipCompression();
              break;
            case "cancel":
              MediaManager.cancelVideoPicking();
              break;
          }
      }
    }

    MediaManager.pickVideoFile(async (data) => {
      
      switch (data.type) {
        case 0:



          setLoadingData(last => {
            if (last.enabled && last.optionButtons && last.onOptionButton) {
              return {
                ...last,
                progress: data.progress * 100
              }
            }
            return {
              ...loadingDataStaticValues,
              progress:data.progress
            }
          });
          
          break;
        
        case 1:

          let successSettingVideo = false;

          setLoadingData({
            enabled: true,
            progress: 1
          });

          if (data.success) {

            const path = data.filePath;

            const srcOptimizedVideo = Capacitor.convertFileSrc(path);

            console.log("Optimized video src: ", srcOptimizedVideo);
            

            successSettingVideo = await setVideo(
              srcOptimizedVideo,
              data.fileName,
              data
            );

            setSheetOpen(false);
          }

          setLoadingData({
            enabled: false
          });
          
          if (!successSettingVideo) {
            setAlertData({
              open: true,
              title: "Error",
              text: "Something went wrong with this file.",
              onAccept() {
                  
              },

              acceptText: "Ok"
            });
          }
          break;
          
        case 2:

          setLoadingData(v => ({
            enabled: false
          }));

          break;
      }
    });
  }

  function openVideoInWeb() {
    const inputElement = document.createElement('input');

    inputElement.type = 'file';
    inputElement.accept = 'video/mp4';
    inputElement.multiple = false;
    inputElement.style.display = 'none';

    inputElement.addEventListener('input', () => { 
      setSheetOpen(false);
      inputElement.remove();

      if (!inputElement.files || inputElement.files.length <= 0) {
        return;
      }
      const videoFile = inputElement.files[0];
      setVideo(URL.createObjectURL(videoFile), videoFile.name)
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

  function onSelectFolderPressed() {
    MediaManager.pickFolder();
  }

  function onOptionPressed(option: OptionCommand) {
    switch (option) {
      case 'openvideo':
        onOpenVideoPressed();
        break;
      
      case 'selectfolder':
        onSelectFolderPressed();
        break;
    
      default:
        break;
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
        

        <SheetContent
          onInteractOutside={() => setSheetOpen(false)}
          onEscapeKeyDown={()=>setSheetOpen(false)}
          className={`${loadingData.enabled ? "hidden" : ""} py-12 [&>button]:hidden`}>
          
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
      
    
      

    {loadingData.enabled && <div className="fixed px-12 z-50 inset-0 bg-secondary vbox gap-4 justify-center items-center">
        {(loadingData.progress == undefined || !isFinite(loadingData.progress)) && <Spinner />}
        
        {loadingData.title && <h1>{loadingData.title}</h1>}
        
        {isFinite(loadingData.progress ?? NaN) &&
          <Progress
            value={loadingData.progress}
            className='w-full' />}
        
        <div className="hbox gap-4">

          {loadingData.optionButtons?.map(
            (optionButtonInfo, index) => {
              
              return <Button
                onClick={()=>loadingData.onOptionButton?.(optionButtonInfo[1])}
                key={index}>
                {optionButtonInfo[0]}
              </Button>
            }
          )}

        </div>
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
    
    const video = videoRef.current as HTMLVideoElement;
    let seekId = -1;
    let syncId = -1;

    const syncCurrentTimeWithVideo = () => {
      syncId = requestAnimationFrame(syncCurrentTimeWithVideo);

      if (video.paused && !video.ended) {
        video
          .play()
          .catch();
      }

      if (playing) {
        video.muted = false;
        videoContext.currentTime = video.currentTime;
      } else {
        video.muted = true;

        if (video.ended) {
          video.currentTime = videoContext.currentTime;
        }
      }

      if (fullscreen && Math.abs(currentTimeState - videoContext.currentTime) >= 0.05) {
        setCurrentTimeState(videoContext.currentTime);
      }

    };

    const seekCurrenTimeFrame = () => {
      seekId = video.requestVideoFrameCallback(seekCurrenTimeFrame);

      if (!playing) {
        video.currentTime = videoContext.currentTime;
      }
    }

    seekCurrenTimeFrame();
    syncCurrentTimeWithVideo();

    return () => {
      cancelAnimationFrame(syncId);
      video.cancelVideoFrameCallback(seekId);
    }


  }, [playing, currentTimeState, fullscreen]);

  useEffect(() => { 
    
    const video = videoRef.current as HTMLVideoElement
    video.style.display = 'none';
    
    if (videoUrl) {
      video.src = videoUrl;
    }
    
  }, [videoUrl]);

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

  function onVideoEnded() {
    pause();
  }

  function onVideoCanPlay() {
    videoRef.current!.style.display = 'unset';
  }

  return (

    <div
      ref={containerRef}
      className={`bg-black ${!fullscreen ? 'pt-4' : ''} w-full h-1 grow contain-content relative`}>
      <video
        style={{display:'none'}}
        onEnded={onVideoEnded}
        onCanPlay={onVideoCanPlay}
        preload='auto'
        className='size-full object-contain'
        ref={videoRef}/>
      
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

  const videoContext = useVideoContext();

  const {
    fullscreen,
    setFullscreen,
    play,
    pause,
    playing,
    videoUrl,
    videoMetadata,
    duration
  } = videoContext;

  const currentTimeSpanRef = useRef<HTMLSpanElement>(null);

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

  useEffect(() => { 

    let loopId = -1;

    const loop = () => {
      loopId = requestAnimationFrame(loop);
      
      if (currentTimeSpanRef.current) {
        currentTimeSpanRef.current.textContent = formatTime(videoContext.currentTime);
      }
    }

    loop();

    return () => {
      cancelAnimationFrame(loopId);
    }

  }, []);

  
  return <>
    
    {videoMetadata &&
    
    
      <div className='absolute left-4 text-xs text-gray-600'>
        <p>
          {Math.floor(videoMetadata.width)}x{Math.floor(videoMetadata.height)} {formatSize(videoMetadata.size)}
        </p>
        <p>
          <span ref={currentTimeSpanRef}></span>/{formatTime(duration)}
        </p>
      </div>
    
    }

    {/* <Button
      disabled={!videoUrl}
      variant={'ghost'}>
      <UndoIcon />  
    </Button> */}
    
    <Button
      variant={'ghost'}
      onPointerUp={onPlaybackSwitchClicked}
      disabled={!videoUrl}>
      {playing ? <PauseIcon fill='white'/> : <PlayIcon fill='white'/>}
    </Button>

    {/* <Button
      disabled={!videoUrl}
      variant={'ghost'}>
      <RedoIcon />
    </Button> */}
    
    <Button
      disabled={!videoUrl}
      className='absolute right-4'
      variant={'ghost'}
      onPointerUp={onFullscreenSwitchClicked}>
      <MaximizeIcon fill='white'/>
    </Button>
  </>
}

function TimelineCutters({
  displacementRef,
  settingGrabberRef,
  framesCanvasRef}: {
    displacementRef: RefObject<number>,
    settingGrabberRef: RefObject<boolean>,
    framesCanvasRef: RefObject<HTMLCanvasElement|null>
  }) {
  type Grabber = 'left' | 'right';

  const GRABBER_THICKNESS = 32;

  const videoContext = useVideoContext();
  const {
    duration,
    videoUrl
  } = videoContext;

  const cutElementRef = useRef<HTMLDivElement>(null);

  function getElements() {
    return {
      cutElement: cutElementRef.current as HTMLDivElement
    }
  }




  function getGrabberValue(grabberName:Grabber) {
    return grabberName == 'left' ? videoContext.trimStart : videoContext.trimEnd;
  }

  useEffect(() => { 
    
    const { cutElement } = getElements();


    let editingGrabber: [mark: Grabber, pointerId: number] | null = null;
    let bothGrabbers:[initialPercentagePosition:number, initialBegin:number, intialEnd:number, pointerId:number]|null = null;
    let loopId = -1;

    const loop = () => {
      const grabberThickness = (8 / framesCanvasRef.current!.offsetWidth);
      loopId = requestAnimationFrame(loop);

      let left = videoContext.trimStart - displacementRef.current - grabberThickness;
      let width = clamp((videoContext.trimEnd - videoContext.trimStart) + grabberThickness*2, 0, 1+grabberThickness*2);
      
      cutElement.style.left = `${left * 100}%`;
      cutElement.style.width = `${width * 100}%`;
      
      if (editingGrabber != null) {
        videoContext.currentTime = duration * getGrabberValue(editingGrabber[0]);
      }
    }

    loop();

    function getHoveredGrabber({ clientX, clientY }: { clientX: number, clientY: number }): Grabber | undefined {
      const rect = cutElement.getBoundingClientRect();


      if (!(clientY > rect.top && clientY < rect.bottom)) {
        return;
      }

      const left = rect.left;
      const right = rect.right;

      const HALF_GRABBER_THICKNESS = GRABBER_THICKNESS * .5;

      const isInLeft = (clientX > left - HALF_GRABBER_THICKNESS && clientX < left + HALF_GRABBER_THICKNESS);
      const isInRight = (clientX > right -HALF_GRABBER_THICKNESS && clientX < right + HALF_GRABBER_THICKNESS)
      
      if (isInLeft) {
        return 'left'
      } else if (isInRight) {
        return 'right';
      }
    }

    function isInsideCutElement({clientX, clientY}:{clientX:number, clientY:number}) {
      const rect = cutElement.getBoundingClientRect();
      
      const isInX = clientX > rect.left && clientX < rect.right;
      const isInY = clientY > rect.top && clientY < rect.bottom;

      return isInX && isInY;
    }

    function clientXToPercentage(clientX:number) {
      const canvasElement = framesCanvasRef.current as HTMLCanvasElement;
      const canvasRect = canvasElement.getBoundingClientRect();
      const percentagePosition = ((clientX - canvasRect.left) / canvasRect.width);
      return percentagePosition;
    }

    function onWindowPointerDown(e: PointerEvent) {
      const grabbed = getHoveredGrabber(e);

      if (grabbed) {
        editingGrabber = [
          grabbed,
          e.pointerId
        ];

        settingGrabberRef.current = true;
      } else if (isInsideCutElement(e)) {
        bothGrabbers = [
          clientXToPercentage(e.clientX),
          videoContext.trimStart,
          videoContext.trimEnd,
          e.pointerId
        ];
        settingGrabberRef.current = true;
      }
    }

    function onWindowPointerMove(e: PointerEvent) {
      
      if (getHoveredGrabber(e) !== undefined) {
        document.body.style.cursor = 'e-resize';
      } else {
        document.body.style.cursor = '';
      }

      if (bothGrabbers && e.pointerId == bothGrabbers[3]) {
        
        const percentagePosition = clientXToPercentage(e.clientX);
        const difference = percentagePosition - bothGrabbers[0];
        
        
        videoContext.trimStart = (bothGrabbers[1] + difference);
        videoContext.trimEnd = (bothGrabbers[2] + difference);

        return;
      }
      
      if (!editingGrabber) {
        return;
      }

      if (editingGrabber[1] !== e.pointerId) {
        return;
      }
      
      const percentagePosition = clientXToPercentage(e.clientX);
      
      switch (editingGrabber[0]) {
        case 'left':
          videoContext.trimStart = (percentagePosition);
          break;
        
        case 'right':
          videoContext.trimEnd = (percentagePosition);
          break;
      }
    }

    function onWindowPointerUp(e: PointerEvent) {
      
      if (editingGrabber !== null) {
        editingGrabber = null;
        settingGrabberRef.current = false; 
      }

      if (bothGrabbers) {
        bothGrabbers = null;        
        settingGrabberRef.current = false;
      }

    }

    window.addEventListener('pointerdown', onWindowPointerDown);
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointermove', onWindowPointerMove);

    return () => {
      cancelAnimationFrame(loopId);
      window.removeEventListener('pointerdown', onWindowPointerUp);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointermove', onWindowPointerMove);
    }
  }, [duration]);

  useEffect(() => { 
    videoContext.trimEnd = 0;
    videoContext.trimEnd = 1;
  }, [videoUrl]);
  
  return (

    <>
      <div
        ref={cutElementRef}
        className={`${!videoUrl ? 'hidden' : ''} border-l-8 border-l-white rounded-[8px] border-r-8 border-r-white bg-[#187db79f] h-full top-0 absolute box-border`}>

      </div>
    
    </>

  );
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
  const pinchingRef = useRef(false);
  const wasPlayingRef = useRef<boolean>(playing);

  const displacementRef = useRef(0);
  const timelineZoomRef = useRef(1);
  const zoomJustChanged = useRef(false);
  const settingGrabberRef = useRef(false);

  function getElements() {
    return {
      framesCanvas: framesCanvasRef.current as HTMLCanvasElement,
      timelinePad: timelinePadRef.current as HTMLDivElement
    };
  }

  function setDisplacement(displacement: number) {

    displacementRef.current = Math.max(
      0,
      Math.min(displacement, 1
    ));
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

    setDisplacement(0);
    zoomJustChanged.current = zoomJustChanged.current = true;

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

            videoForRender.addEventListener('seeked', draw, { once: true });
            // videoForRender.requestVideoFrameCallback(draw);
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
        const newCurrentTime = displacementRef.current * duration;
        if (Math.abs(newCurrentTime - videoContext.currentTime) > 0.04 && !settingGrabberRef.current) {
          videoContext.currentTime = newCurrentTime;
        }
      }

      if (zoomJustChanged.current) {
        zoomJustChanged.current = false;


        const canvasWidth = duration * SECOND_WIDTH * timelineZoomRef.current;
        framesCanvas.width = canvasWidth;
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


  // Sync displacement with playing video
  useEffect(() => {

    const { framesCanvas } = getElements();
    let onFrameId = -1;

    const onFrame = () => {
      onFrameId = requestAnimationFrame(onFrame);

      if (pointersRef.current.length <= 0) {
        displacementRef.current = videoContext.currentTime / duration;
      }

      framesCanvas.style.left = `${(displacementRef.current * -framesCanvas.offsetWidth)}px`;
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
      if (pointersRef.current.length === 1) {
        if (wasPlayingRef.current) {
          play();
        }
      }
      
      pointersRef.current = pointersRef.current.filter(pInfo => pInfo.id !== event.pointerId);
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
      if (hasPointer(e.pointerId) && pointersRef.current.length <= 1 && !pinchingRef.current && !settingGrabberRef.current) {
        e.preventDefault();
        setDisplacement(displacementRef.current - e.movementX / framesCanvas.width);
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
    }

    let initialDistance:number|null = null;
    let initialZoom:number = 0;

    function getDistance(touch1:Touch, touch2:Touch) {
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function onTouchStart(e:TouchEvent) {
      if (e.touches.length > 1 && !initialDistance) {
        const [touch1, touch2] = e.touches;
        initialDistance = getDistance(touch1, touch2);
        initialZoom = timelineZoomRef.current;
        pinchingRef.current = true;
      }
    }

    function onTouchMove(e:TouchEvent) {
      if (e.touches.length === 2 && initialDistance) {
        const currentDistance = getDistance(e.touches[0], e.touches[1]);
        const scale = currentDistance / initialDistance;

        const newZoom = Math.max(MIN_ZOOM, initialZoom + (scale - 1) / 2);

        timelineZoomRef.current = Math.min(newZoom, MAX_ZOOM);
        zoomJustChanged.current = true;
      }
    }

    function onTouchEnd(e:TouchEvent) {
      if (e.touches.length < 2) {
        initialDistance = null;
        initialZoom = 0;
        pinchingRef.current = false;
      }
    }

    timelinePad.addEventListener('wheel', onTimelineWheel);

    timelinePad.addEventListener('touchstart', onTouchStart);
    timelinePad.addEventListener('touchend', onTouchEnd);
    timelinePad.addEventListener('touchmove', onTouchMove);

    return () => {
      // window.removeEventListener('pointermove', onWindowPointerMove);
      timelinePad.removeEventListener('wheel', onTimelineWheel);
      timelinePad.removeEventListener('touchstart', onTouchStart);
      timelinePad.removeEventListener('touchend', onTouchEnd);
      timelinePad.removeEventListener('touchmove', onTouchMove);
    }
  }, [duration]);


  return (
    <>

      <div
        className='relative py-2 px-4 size-full vbox justify-center'>
        
        <div
          ref={timelinePadRef}
          className='overflow-hidden touch-none rounded-[8px] bg-gray-900 w-full h-[100%] max-h-[300px] relative'>
          
          <div
            className='absolute left-1/2 top-1/2 -translate-y-1/2 w-fit h-[100%] max-h-[100px]'>
            <canvas
              ref={framesCanvasRef}
              className='touch-none select-none outline-violet-900 outline-[4px] rounded-[8px] relative h-[100%] max-h-[100px] bg-blue-300'/>
            <TimelineCutters
              displacementRef={displacementRef}
              settingGrabberRef={settingGrabberRef}
              framesCanvasRef={framesCanvasRef}/>
          </div>
          
        </div>

        <div
          className='pointer-events-none  bg-blue-500 absolute -translate-x-1/2 left-1/2 h-full w-[3px]'>
          
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

  const videoContext = useVideoContext();

  const {
    videoName,
    duration,
    addDoneCut,
    removeDoneCut,
    setDoneCut,
    setAlertData
  } = videoContext;

  function onCutButtonPressed() {

    const startTime = videoContext.trimStart * duration
    const endTime = videoContext.trimEnd * duration

    const process: DoneCut = [
      startTime,
      endTime,
      'trimming',
      undefined
    ];

    const doneCutId = addDoneCut(process);

    MediaManager.makeTrim({
      start: Math.floor(startTime * 1000),
      end: Math.floor(endTime * 1000)
    }).then((data) => {
      
      if (data.code == 4) {
        process[2] = 'done';
        process[3] = data.uri;
        setDoneCut(process, doneCutId);
      } else if (data.code == 3) {
        process[2] = 'failed';
        setDoneCut(process, doneCutId);
      } else if (data.code == 0) {
        setAlertData({
          open: true,
          title:"Hold on!",
          text: "You haven't selected a folder to save the clips.",
          acceptText: "Pick folder",
          cancelText: "Cancel",

          onAccept() {
            removeDoneCut(doneCutId);
            MediaManager.pickFolder()
              .then(onCutButtonPressed);
          },

          onCancel() {
            removeDoneCut(doneCutId);
          }
        })
      }

    });
  }


  return (
    <div className="h-screen w-screen vbox py-8 max-w-[600px] mx-auto">

      <div className="hbox h-fit px-5 py-5 gap-4 items-center">
        <span className='grow overflow-hidden text-ellipsis text-nowrap'>{videoName ? videoName : "..."}</span>
        <TaskUI/>
        <Button onClick={onCutButtonPressed}>Cut <ScissorsIcon/></Button>
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

package com.bastiasa.blogcutter

import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.MediaStore.MediaColumns
import android.util.Base64
import android.util.Log
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import com.daasuu.mp4compose.FillMode
import com.daasuu.mp4compose.VideoFormatMimeType
import com.daasuu.mp4compose.composer.Mp4Composer
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.io.FileInputStream

@CapacitorPlugin(name = "MediaManager")
class MediaManager:Plugin() {

    val PICK_TYPE_PROGRESS = 0
    val PICK_TYPE_CHUNK = 1
    val PICK_TYPE_ENDED = 2

    val OPTIMIZED_VIDEO_MAX_SIZE = 864
    val OPTIMIZED_VIDEO_BITRATE = 50


    private var composer:Mp4Composer? = null

    private var currentVideoPickCall:PluginCall? = null
    private lateinit var pickVideoActivity:ActivityResultLauncher<PickVisualMediaRequest>

    private fun log(message: String) {
        Log.d("Capacitor/MediaManager", message)
    }


    private fun processPickedVideo(pickedVideo:Uri, call: PluginCall) {

        log("Video picked: $pickedVideo")

        val resolver = context.contentResolver

        val mimeType = resolver.getType(pickedVideo)
        val extension = mimeType!!.split('/')[1]
        val stream = resolver.openInputStream(pickedVideo)

        val videoFile = File(context.cacheDir, "video.$extension")
        val optimizedVideoFile = File(context.cacheDir, "optimized.mp4")

        stream.use {
            if (!videoFile.exists()) {
                videoFile.createNewFile()
            }

            videoFile.writeBytes(it!!.readBytes())
        }


        val retriever = MediaMetadataRetriever()

        retriever.setDataSource(context, pickedVideo)

        val videoNaturalWidth = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)!!.toInt()
        val videoNaturalHeight = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)!!.toInt()

        var optimizedWidth = videoNaturalWidth
        var optimizedHeight = videoNaturalHeight

        if (OPTIMIZED_VIDEO_MAX_SIZE < videoNaturalWidth) {
            optimizedWidth = OPTIMIZED_VIDEO_MAX_SIZE
            optimizedHeight = (optimizedWidth.toDouble() / videoNaturalWidth.toDouble() * videoNaturalHeight.toDouble()).toInt()
        } else if (OPTIMIZED_VIDEO_MAX_SIZE < videoNaturalHeight) {
            optimizedHeight = OPTIMIZED_VIDEO_MAX_SIZE
            optimizedWidth = (optimizedHeight.toDouble() / videoNaturalHeight.toDouble() * videoNaturalWidth.toDouble()).toInt()
        }

        log("Video size calculated: $videoNaturalWidth, $videoNaturalHeight -> $optimizedWidth, $optimizedHeight")

        retriever.release()

        val finished =  { success:Boolean  ->

            if (!success) {
                call.resolve(
                    JSObject().apply {
                        put("type", PICK_TYPE_ENDED)
                        put("success", false)
                    }
                )
                log("MP4Composer failed")
            } else {

                if (!optimizedVideoFile.exists()) {
                    JSObject().apply {
                        put("type", PICK_TYPE_ENDED)
                    }
                    log("Finished but the optimized video file doesn't exists")
                }

                FileInputStream(optimizedVideoFile).use { input ->
                    val chunkSize = 1024 * 256
                    val buffer = ByteArray(chunkSize)
                    var bytesRead:Int

                    while(input.read(buffer).also { bytesRead = it } != -1) {
                        val chunk = buffer.copyOf()
                        val encodedChunk = Base64.encodeToString(chunk, Base64.NO_WRAP)

                        call.resolve(
                            JSObject().apply {
                                put("type", PICK_TYPE_CHUNK)
                                put("chunk", encodedChunk)
                                put("totalSize", optimizedVideoFile.length())
                            }
                        )

                        //log("Chunk sent: ${encodedChunk.length} bytes")
                    }
                }

                val cursor = resolver.query(pickedVideo, null, null, null, null)
                var fileName:String = "Unknown.mp4"

                cursor?.use {
                    val nameIndex = it.getColumnIndex(MediaColumns.DISPLAY_NAME)
                    if (nameIndex != -1 && it.moveToFirst()) {
                        fileName = it.getString(nameIndex)
                    }
                }

                call.resolve(
                    JSObject().apply {
                        put("type", PICK_TYPE_ENDED)
                        put("success", true)
                        put("fileName", fileName)
                    }
                )
                log("Video was successfully optimized")

            }

            bridge.releaseCall(call)
        }

        val listener = object : Mp4Composer.Listener {
            override fun onProgress(progress: Double) {
                call.resolve(
                    JSObject().apply {
                        put("type", PICK_TYPE_PROGRESS)
                        put("progress", progress)
                    }
                )

                //log("Optimization progress: ${(progress * 100).toInt()}%")
            }

            override fun onCurrentWrittenVideoTime(timeUs: Long) {

            }

            override fun onCompleted() {
                finished(true)
            }

            override fun onCanceled() {
                log("MP4Composer cancelled")
                finished(false)
            }

            override fun onFailed(exception: Exception?) {
                log("MP4Composer failed")
                exception?.printStackTrace()
                finished(false)
            }

        }

        log("Starting optimization...")

        composer = Mp4Composer(
            videoFile.absolutePath,
            optimizedVideoFile.absolutePath
        )
            .fillMode(FillMode.PRESERVE_ASPECT_FIT)
            .videoFormatMimeType(VideoFormatMimeType.AVC)
            .videoBitrate(OPTIMIZED_VIDEO_BITRATE)
            .size(optimizedWidth, optimizedHeight)
            .listener(listener)
            .start()





    }

    override fun handleOnStart() {
        super.handleOnStart()
        pickVideoActivity = activity.registerForActivityResult(
            ActivityResultContracts.PickVisualMedia()
        ) { result ->
            result?.let {
                if (currentVideoPickCall != null) {
                    processPickedVideo(it, currentVideoPickCall!!)
                }

            }
            currentVideoPickCall = null
        }
    }

    @PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)
    fun pickVideoFile(call:PluginCall) {
        currentVideoPickCall = call
        call.setKeepAlive(true);
        bridge.saveCall(call)

        pickVideoActivity.launch(
            PickVisualMediaRequest(
                ActivityResultContracts.PickVisualMedia.VideoOnly
            )
        )
    }

}
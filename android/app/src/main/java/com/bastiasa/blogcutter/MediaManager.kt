package com.bastiasa.blogcutter

import android.content.Intent
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.MediaStore.MediaColumns
import android.util.Base64
import android.util.Log
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.net.toUri
import androidx.documentfile.provider.DocumentFile
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
import java.io.FileOutputStream

@CapacitorPlugin(name = "MediaManager")
class MediaManager:Plugin() {

    val PICK_TYPE_PROGRESS = 0
    val PICK_TYPE_ENDED = 1

    val MAKE_TRIM_FOLDER_ERROR = 0
    val MAKE_TRIM_INVALID_ARGS = 1
    val MAKE_TRIM_UNSELECTED_VIDEO = 2
    val MAKE_TRIM_FAILED = 3
    val MAKE_TRIM_ENDED = 4

    val OPTIMIZED_VIDEO_MAX_SIZE = 864
    val OPTIMIZED_VIDEO_BITRATE = 50

    private lateinit var pickFolderActivity:ActivityResultLauncher<Uri?>

    private lateinit var pickVideoActivity:ActivityResultLauncher<PickVisualMediaRequest>
    private var currentVideoPickCall:PluginCall? = null
    private var folderPickCall: PluginCall? = null

    private var currentVideo:File? = null
    private var clipsFolderUri:Uri? = null

    private var composer:Mp4Composer? = null
    private var clipId = 0


    private fun log(message: String) {
        Log.d("Capacitor/MediaManager", message)
    }

    fun resolveCall(call: PluginCall, arguments:Map<String, Any>? = null) {

        val jsObject = JSObject()

        arguments?.keys?.forEach { key ->
            jsObject.put(key, arguments[key])
        }

        call.resolve(jsObject)
    }

    private fun canAccessFolder():Boolean{
        return try {

            val folder = DocumentFile.fromTreeUri(context, clipsFolderUri)
            folder != null && folder.canRead() && folder.exists()
        } catch (e:Exception) {
            false
        }
    }

    private fun processPickedVideo(pickedVideo:Uri, call: PluginCall) {

        log("Video picked: $pickedVideo")

        val resolver = context.contentResolver

        val mimeType = resolver.getType(pickedVideo)
        val extension = mimeType!!.split('/')[1]
        val stream = resolver.openInputStream(pickedVideo)

        val videoFile = File(context.cacheDir, "video.$extension")
        val optimizedVideoFile = File.createTempFile("optimized_video", ".mp4", context.cacheDir)

        stream!!.use { input ->

            FileOutputStream(videoFile).use { output->
                val buffer = ByteArray(32 * 1024)
                var bytesRead:Int

                while(input.read(buffer).also { bytesRead = it } != -1 ) {
                    output.write(buffer, 0, bytesRead)
                }

                output.flush()
            }
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
                        put("filePath", optimizedVideoFile.absolutePath)
                        put("width", videoNaturalWidth)
                        put("height", videoNaturalHeight)
                        put("size", videoFile.length())
                    }
                )

                currentVideo = videoFile
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

        pickFolderActivity = activity.registerForActivityResult(
            ActivityResultContracts.OpenDocumentTree()
        ) { folderUri ->

            clipsFolderUri = folderUri

            folderPickCall?.let {
                resolveCall(it)
                bridge.releaseCall(it)
                folderPickCall = null
            }
        }
    }

    @PluginMethod
    fun openVideo(call: PluginCall) {

        val uri = call.getString("uri")

        if (uri == null) {
            return
        }

        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(Uri.parse(uri), "video/*")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

        val chooser = Intent.createChooser(intent, "Open with...")
        activity.startActivity(chooser)

        call.resolve()
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

    @PluginMethod
    fun pickFolder(call:PluginCall) {
        bridge.saveCall(call)
        folderPickCall = call
        pickFolderActivity.launch(null)
    }

    @PluginMethod
    fun makeTrim(call:PluginCall) {

        log("Trim request")

        bridge.saveCall(call)

        val resolveCall = { code:Int ->
            this@MediaManager.resolveCall(
                call,
                mapOf(
                    "code" to code
                )
            )

            bridge.releaseCall(call)
        }

        val start = call.getInt("start")?.toLong()
        val end = call.getInt("end")?.toLong()
        lateinit var folder:DocumentFile

        if (start == null || end == null) {
            log("Invalid start and end arguments. Trim cancelled")
            resolveCall(MAKE_TRIM_INVALID_ARGS)
            return
        }

        if (currentVideo == null) {

            log("There is not a video file. Trim cancelled")

            resolveCall(call, mapOf(
                "code" to MAKE_TRIM_UNSELECTED_VIDEO
            ))
            return
        }

        if (clipsFolderUri == null || !canAccessFolder()) {
            resolveCall(MAKE_TRIM_FOLDER_ERROR)
            return
        } else {
            val givenFolder = DocumentFile.fromTreeUri(context, clipsFolderUri!!)

            if (givenFolder == null) {
                log("It seems there is not a folder for save clips. Trim cancelled")
                resolveCall(MAKE_TRIM_FOLDER_ERROR)
                return
            }
            folder = givenFolder
        }

        clipId++
        val clipFile = folder
            .createFile(
                "video/${currentVideo!!.extension}",
                "clip-$clipId.${currentVideo!!.extension}"
            ) as DocumentFile

        val fullVideoInputStream = FileInputStream(currentVideo!!)
        val currentVideoFd = fullVideoInputStream.fd
        val clipFileDescriptor = activity.contentResolver.openFileDescriptor(clipFile.uri, "w")

        val close = {
            fullVideoInputStream.close()
            clipFileDescriptor?.close()
        }

        val listener = object : Mp4Composer.Listener {
            override fun onProgress(progress: Double) {

            }

            override fun onCurrentWrittenVideoTime(timeUs: Long) {
            }

            override fun onCompleted() {
                log("Trim completed successfully!")
                close()
                resolveCall(call, mapOf(
                    "code" to MAKE_TRIM_ENDED,
                    "uri" to clipFile.uri.toString()
                ))
            }

            override fun onCanceled() {
                log("Trim cancelled")
                close()
                resolveCall(MAKE_TRIM_FAILED)
            }

            override fun onFailed(exception: java.lang.Exception?) {
                log("Trim failed")
                exception?.printStackTrace()
                close()
                resolveCall(MAKE_TRIM_FAILED)
            }

        }

        Mp4Composer(
            currentVideoFd,
            clipFileDescriptor!!.fileDescriptor
        )
            .trim(start, end)
            .listener(listener)
            .start()

    }

}
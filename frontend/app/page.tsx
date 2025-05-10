"use client"

import { useState, useRef, useCallback } from "react"
import Image from "next/image"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Upload, Camera, RefreshCw, ZoomIn, Sun, Moon, Bell, BellOff } from "lucide-react"
import { useDropzone } from "react-dropzone"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { useMobile } from "@/hooks/use-mobile"

export default function SpaceStationDetection() {
  const [mode, setMode] = useState<"upload" | "webcam">("upload")
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [warningEnabled, setWarningEnabled] = useState(true)
  const [missingItems, setMissingItems] = useState<string[]>([])
  const [showWarning, setShowWarning] = useState(false)
  const [confidenceScores, setConfidenceScores] = useState<{ [key: string]: number }>({})
  const [dialogOpen, setDialogOpen] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { toast } = useToast()
  const isMobile = useMobile()

  // Handle file drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      setSelectedImage(file)
      setResultImage(null)
      setMissingItems([])
      setShowWarning(false)

      // Create preview URL
      const objectUrl = URL.createObjectURL(file)
      setPreviewUrl(objectUrl)

      return () => URL.revokeObjectURL(objectUrl)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp"],
    },
    maxFiles: 1,
  })

  // Handle webcam
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setIsCameraActive(true)
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Camera Error",
        description: "Could not access webcam. Please check permissions.",
      })
    }
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
      setIsCameraActive(false)
    }
  }

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext("2d")

      if (context) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0, canvas.width, canvas.height)

        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "webcam-capture.jpg", { type: "image/jpeg" })
            setSelectedImage(file)
            setPreviewUrl(URL.createObjectURL(blob))
            detectObjects(file)
          }
        }, "image/jpeg")
      }
    }
  }

  // // Check for missing items
  // const checkMissingItems = async (imageFile: File) => {
  //   if (!warningEnabled) return

  //   try {
  //     const formData = new FormData()
  //     formData.append("image", imageFile)

  //     const response = await fetch("http://127.0.0.1:8000/check-missing", {
  //       method: "POST",
  //       body: formData,
  //     })

  //     if (!response.ok) {
  //       throw new Error(`Error: ${response.status} ${response.statusText}`)
  //     }

  //     const data = await response.json()

  //     if (data.missing_classes && data.missing_classes.length > 0) {
  //       // Convert class IDs to names
  //       const classNames = {
  //         0: "Fire Extinguisher",
  //         1: "Toolbox",
  //         2: "Oxygen Tank",
  //       }

  //       const missingNames = data.missing_classes.map(
  //         (id: number) => classNames[id as keyof typeof classNames] || `Item ${id}`,
  //       )
  //       setMissingItems(missingNames)
  //       setShowWarning(true)

  //       // Voice alert
  //       if ("speechSynthesis" in window) {
  //         const message = new SpeechSynthesisUtterance(`Warning! Missing critical items: ${missingNames.join(", ")}`)
  //         window.speechSynthesis.speak(message)
  //       }

  //       toast({
  //         variant: "destructive",
  //         title: "Missing Items Detected",
  //         description: `Critical items missing: ${missingNames.join(", ")}`,
  //       })
  //     } else {
  //       setMissingItems([])
  //       setShowWarning(false)
  //     }
  //   } catch (err) {
  //     console.error("Error checking missing items:", err)
  //   }
  // }

  // Check for missing and detected items
  const checkItems = async (imageFile: File) => {
    if (!warningEnabled) return

    try {
      const formData = new FormData()
      formData.append("image", imageFile)

      // Check Missing Items
      const missingResponse = await fetch("http://127.0.0.1:8000/check-missing", {
        method: "POST",
        body: formData,
      })

      if (!missingResponse.ok) {
        throw new Error(`Error: ${missingResponse.status} ${missingResponse.statusText}`)
      }

      const missingData = await missingResponse.json()

      // Class ID to Name Mapping
      const classNames: Record<number, string> = {
        0: "Fire Extinguisher",
        1: "Toolbox",
        2: "Oxygen Tank",
      }

      // Process Missing Items
      if (missingData.missing_classes && missingData.missing_classes.length > 0) {
        const missingNames = missingData.missing_classes.map((id: number) => classNames[id] || `Item ${id}`)

        setMissingItems(missingNames)
        setShowWarning(true) // This will trigger the popup
        setDialogOpen(true) // This will open the dialog

        // Voice Alert for Missing Items
        if ("speechSynthesis" in window) {
          const missingMessage = new SpeechSynthesisUtterance(
            `Warning! Missing critical items: ${missingNames.join(", ")}`,
          )
          window.speechSynthesis.speak(missingMessage)
        }

        // Toast Notification for Missing Items
        toast({
          variant: "destructive",
          title: "Missing Items Detected",
          description: `Critical items missing: ${missingNames.join(", ")}`,
        })
      } else {
        setMissingItems([])
        setShowWarning(false)
      }

      // Check Detected Items
      const detectedResponse = await fetch("http://127.0.0.1:8000/detected-items", {
        method: "POST",
        body: formData,
      })

      if (!detectedResponse.ok) {
        throw new Error(`Error: ${detectedResponse.status} ${detectedResponse.statusText}`)
      }

      const detectedData = await detectedResponse.json()

      // Process Detected Items
      if (detectedData.detected_items && detectedData.detected_items.length > 0) {
        const detectedNames = detectedData.detected_items.map(
          (item: { class_id: number; class_name: string }) => classNames[item.class_id] || item.class_name,
        )

        // Voice Alert for Detected Items
        if ("speechSynthesis" in window) {
          const detectedMessage = new SpeechSynthesisUtterance(`Detected items: ${detectedNames.join(", ")}`)
          window.speechSynthesis.speak(detectedMessage)
        }

        // Toast Notification for Detected Items
        toast({
          variant: "default",
          title: "Items Detected",
          description: `Detected items: ${detectedNames.join(", ")}`,
        })
      }
    } catch (err) {
      console.error("Error checking items:", err)
    }
  }

  // Handle object detection
  const detectObjects = async (imageFile: File = selectedImage!) => {
    if (!imageFile) {
      toast({
        variant: "destructive",
        title: "No Image Selected",
        description: "Please upload or capture an image first.",
      })
      return
    }

    setIsLoading(true)
    setMissingItems([])
    setShowWarning(false)

    try {
      const formData = new FormData()
      formData.append("image", imageFile)

      const response = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        body: formData,
      })
      console.log("this is our response ", response)
      console.log("this is our form data ", response.formData)

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      if (data.image) {
        setResultImage(`data:image/jpeg;base64,${data.image}`)

        // Use real scores from API
        if (Array.isArray(data.detections) && data.detections.length > 0) {
          const scores: Record<string, number> = {}
          data.detections.forEach((det: any) => {
            // det.class_name and det.confidence come from your FastAPI
            scores[det.class_name] = det.confidence * 100
          })
          setConfidenceScores(scores)
        } else {
          // no detections → clear out any old scores
          setConfidenceScores({})
        }

        toast({
          title: "Detection Complete",
          description: "Objects have been successfully detected.",
        })

        // Check for missing items if warning is enabled
        if (warningEnabled) {
          await checkItems(imageFile)
        }
      } else {
        throw new Error("No image data received from the API")
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Detection Failed",
        description: err instanceof Error ? err.message : "Failed to detect objects",
      })
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  // Toggle dark mode
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
    document.documentElement.classList.toggle("dark")
  }

  // Toggle warning mode
  const toggleWarningMode = () => {
    setWarningEnabled(!warningEnabled)
    if (!warningEnabled) {
      // If we're enabling warnings and already have a result, check for missing items
      if (selectedImage && resultImage) {
        checkItems(selectedImage)
      }
    } else {
      // If we're disabling warnings, clear any existing warnings
      setMissingItems([])
      setShowWarning(false)

      // Stop any ongoing speech
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
    }
  }

  return (
    <div
      className={cn(
        "min-h-screen transition-colors duration-300",
        isDarkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900",
      )}
    >
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">🔍 Space Station Object Detection</h1>
          <p className="text-lg opacity-80 max-w-2xl mx-auto">
            Detect critical items like toolboxes, oxygen tanks, and fire extinguishers in synthetic space data
          </p>

          {/* Dark Mode and Warning Toggles */}
          <div className="flex items-center justify-center mt-4 space-x-6">
            <div className="flex items-center">
              <Sun className="h-4 w-4 mr-2" />
              <Switch checked={isDarkMode} onCheckedChange={toggleDarkMode} id="dark-mode" />
              <Moon className="h-4 w-4 ml-2" />
            </div>

            <div className="flex items-center">
              <BellOff className={cn("h-4 w-4 mr-2", !warningEnabled && "text-primary")} />
              <Switch checked={warningEnabled} onCheckedChange={toggleWarningMode} id="warning-mode" />
              <Bell className={cn("h-4 w-4 ml-2", warningEnabled && "text-primary")} />
            </div>
          </div>
        </header>

        {/* Warning Banner */}
        {showWarning && warningEnabled && (
          <div className="max-w-4xl mx-auto mb-6">
            <Alert variant="destructive" className="animate-pulse">
              <div className="flex items-center">
                <Bell className="h-4 w-4 mr-2" />
                <AlertTitle>Missing Critical Items</AlertTitle>
                <AlertDescription>The following items are missing: {missingItems.join(", ")}</AlertDescription>
              </div>
              <Button variant="outline" size="sm" className="ml-auto" onClick={() => setDialogOpen(false)}>
                Dismiss
              </Button>
            </Alert>
          </div>
        )}

        {/* Missing Items Popup */}
        <Dialog open={dialogOpen && warningEnabled} onOpenChange={(open) => setDialogOpen(open)}>
          <DialogContent className="sm:max-w-md">
            <div className="p-4 text-center">
              <div className="bg-red-100 text-red-700 p-4 rounded-full inline-flex items-center justify-center mb-4">
                <Bell className="h-8 w-8 animate-pulse" />
              </div>
              <h2 className="text-xl font-bold mb-2">Missing Critical Items</h2>
              <p className="mb-4">The following items are required for safety:</p>
              <ul className="space-y-2 mb-6">
                {missingItems.map((item, index) => (
                  <li key={index} className="flex items-center justify-center">
                    <span className="mr-2">🚨</span>
                    {item}
                  </li>
                ))}
              </ul>
              <Button onClick={() => setDialogOpen(false)} className="w-full">
                Acknowledge
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Main Content */}
        <Tabs
          defaultValue="upload"
          className="max-w-4xl mx-auto"
          onValueChange={(value) => {
            setMode(value as "upload" | "webcam")
            if (value === "webcam") {
              setResultImage(null)
            } else {
              stopCamera()
            }
          }}
        >
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="upload">Upload Mode</TabsTrigger>
            <TabsTrigger value="webcam">Webcam Mode</TabsTrigger>
          </TabsList>

          {/* Upload Mode */}
          <TabsContent value="upload" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Upload Area */}
              <Card className={cn("transition-all", isDarkMode ? "bg-gray-800 border-gray-700" : "")}>
                <CardHeader>
                  <CardTitle>Upload Image</CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    {...getRootProps()}
                    className={cn(
                      "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                      isDragActive ? "border-primary bg-primary/10" : "border-gray-300",
                      isDarkMode ? "hover:border-gray-500" : "hover:border-gray-400",
                    )}
                  >
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <Upload className="h-10 w-10 text-gray-400" />
                      <div>
                        <p className="font-medium">Upload image or drag here</p>
                        <p className="text-sm text-gray-500">PNG, JPG, GIF up to 10MB</p>
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  {previewUrl && (
                    <div className="mt-4 space-y-2">
                      <div className="relative w-full h-48 md:h-64 rounded-lg overflow-hidden border">
                        <Image src={previewUrl || "/placeholder.svg"} alt="Preview" fill className="object-contain" />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-sm truncate">
                          {selectedImage?.name} (
                          {(selectedImage?.size || 0) / 1024 < 1000
                            ? `${Math.round((selectedImage?.size || 0) / 1024)} KB`
                            : `${Math.round(((selectedImage?.size || 0) / 1024 / 1024) * 10) / 10} MB`}
                          )
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedImage(null)
                            setPreviewUrl(null)
                          }}
                        >
                          Change
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={() => detectObjects()}
                    disabled={!selectedImage || isLoading}
                    className="w-full relative overflow-hidden group"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <span className="mr-2">🧠</span>}
                    {isLoading ? "Processing..." : "Detect Objects"}
                    <span className="absolute bottom-0 left-0 h-1 bg-white/20 w-full transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
                  </Button>
                </CardFooter>
              </Card>

              {/* Results Area */}
              <Card className={cn("transition-all", isDarkMode ? "bg-gray-800 border-gray-700" : "")}>
                <CardHeader>
                  <CardTitle>Detection Results</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                      <p>Analyzing image...</p>
                    </div>
                  ) : resultImage ? (
                    <Dialog>
                      <DialogTrigger asChild>
                        <div className="relative w-full h-48 md:h-64 rounded-lg overflow-hidden border cursor-pointer group">
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 z-10">
                            <ZoomIn className="h-8 w-8 text-white drop-shadow-lg" />
                          </div>
                          <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.1)] rounded-lg pointer-events-none"></div>
                          <Image
                            src={resultImage || "/placeholder.svg"}
                            alt="Detection Result"
                            fill
                            className="object-contain"
                          />

                          {/* Confidence Scores Overlay */}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white p-2 text-sm">
                            {Object.entries(confidenceScores).length > 0 ? (
                              <>
                                <h2 className="font-semibold mb-1">Detected Items:</h2>
                                {Object.entries(confidenceScores).map(([label, score]) => (
                                  <div key={label} className="flex items-center justify-between mb-1 last:mb-0">
                                    <span>{label}</span>
                                    <div className="flex items-center space-x-2">
                                      <Progress value={score} className="w-24 h-2" />
                                      <span>{Math.round(score)}%</span>
                                    </div>
                                  </div>
                                ))}
                              </>
                            ) : (
                              <p>No items detected.</p>
                            )}
                          </div>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh]">
                        <div className="relative w-full h-[70vh]">
                          <Image
                            src={resultImage || "/placeholder.svg"}
                            alt="Detection Result"
                            fill
                            className="object-contain"
                          />
                        </div>
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <div className="text-center text-gray-500">
                      <p>Upload and process an image to see detection results</p>
                    </div>
                  )}

                  {/* Detected and Missing Items Section */}
                  {Object.entries(confidenceScores).length > 0 && (
                    <div className="w-full p-4 border border-green-500 bg-green-100 rounded-lg text-green-700">
                      <h3 className="font-semibold mb-2 flex items-center">
                        <Bell className="h-4 w-4 mr-2" />
                        Detected Items
                      </h3>
                      <ul className="space-y-1">
                        {Object.entries(confidenceScores).map(([label, score]) => (
                          <li key={label} className="flex items-center justify-between">
                            <span>{label}</span>
                            <span className="font-medium">{Math.round(score)}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {warningEnabled && showWarning && missingItems.length > 0 && (
                    <div className="w-full p-4 border border-red-500 bg-red-100 rounded-lg text-red-700">
                      <h3 className="font-semibold mb-2 flex items-center">
                        <Bell className="h-4 w-4 mr-2" />
                        Missing Critical Items
                      </h3>
                      <ul className="space-y-1">
                        {missingItems.map((item, index) => (
                          <li key={index} className="flex items-center">
                            <span className="mr-2">🚨</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                      <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowWarning(false)}>
                        Dismiss
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Webcam Mode */}
          <TabsContent value="webcam" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Webcam Area */}
              <Card className={cn("transition-all", isDarkMode ? "bg-gray-800 border-gray-700" : "")}>
                <CardHeader>
                  <CardTitle>Webcam Capture</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative w-full h-64 md:h-72 rounded-lg overflow-hidden border mb-4">
                    <div
                      className={cn(
                        "absolute inset-0 rounded-lg transition-all duration-1000",
                        isCameraActive ? "shadow-[0_0_0_3px_rgba(59,130,246,0.5)]" : "",
                      )}
                    ></div>
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover rounded-lg" />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col space-y-2">
                  <div className="flex space-x-2 w-full">
                    <Button
                      onClick={isCameraActive ? stopCamera : startCamera}
                      className="flex-1"
                      variant={isCameraActive ? "destructive" : "default"}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      {isCameraActive ? "Stop Camera" : "Start Camera"}
                    </Button>
                    <Button onClick={captureImage} disabled={!isCameraActive || isLoading} className="flex-1">
                      {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <span className="mr-2">📸</span>}
                      Capture & Detect
                    </Button>
                  </div>
                </CardFooter>
              </Card>

              {/* Results Area (same as upload mode) */}
              <Card className={cn("transition-all", isDarkMode ? "bg-gray-800 border-gray-700" : "")}>
                <CardHeader>
                  <CardTitle>Detection Results</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center min-h-[300px]">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                      <p>Analyzing image...</p>
                    </div>
                  ) : resultImage ? (
                    <Dialog>
                      <DialogTrigger asChild>
                        <div className="relative w-full h-48 md:h-64 rounded-lg overflow-hidden border cursor-pointer group">
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 z-10">
                            <ZoomIn className="h-8 w-8 text-white drop-shadow-lg" />
                          </div>
                          <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.1)] rounded-lg pointer-events-none"></div>
                          <Image
                            src={resultImage || "/placeholder.svg"}
                            alt="Detection Result"
                            fill
                            className="object-contain"
                          />

                          {/* Confidence Scores Overlay */}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white p-2 text-sm">
                            {Object.entries(confidenceScores).length > 0 ? (
                              <>
                                <h2 className="font-semibold mb-1">Detected Items:</h2>
                                {Object.entries(confidenceScores).map(([label, score]) => (
                                  <div key={label} className="flex items-center justify-between mb-1 last:mb-0">
                                    <span>{label}</span>
                                    <div className="flex items-center space-x-2">
                                      <Progress value={score} className="w-24 h-2" />
                                      <span>{Math.round(score)}%</span>
                                    </div>
                                  </div>
                                ))}
                              </>
                            ) : (
                              <p>No items detected.</p>
                            )}
                          </div>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh]">
                        <div className="relative w-full h-[70vh]">
                          <Image
                            src={resultImage || "/placeholder.svg"}
                            alt="Detection Result"
                            fill
                            className="object-contain"
                          />
                        </div>
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <div className="text-center text-gray-500">
                      <p>Capture an image to see detection results</p>
                    </div>
                  )}
                </CardContent>
                {resultImage && (
                  <CardFooter>
                    <Button variant="outline" onClick={() => setResultImage(null)} className="w-full">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Re-capture
                    </Button>
                  </CardFooter>
                )}
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <footer className="mt-16 text-center text-sm opacity-70">
          <p>Built by Team HackathonAI — Falcon Challenge 2025</p>
        </footer>
      </div>
    </div>
  )
}

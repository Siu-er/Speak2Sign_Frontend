"use client";

import React, { useCallback, useState } from "react";
import { WebcamCapture, SignRecognitionResult } from "@/app/components/WebcamCapture";
import { RecognizedSignsDisplay } from "@/app/components/RecognizedSignsDisplay";
import { Card } from "@/app/components/ui/card";
import { Accessibility, Camera, Hand, Volume2 } from "lucide-react";

interface RecognizedSign {
  sign: string;
  confidence: number;
  timestamp: number;
}

export default function SignToSpeechPage() {
  const [recognizedSigns, setRecognizedSigns] = useState<RecognizedSign[]>([]);
  const [captureStatus, setCaptureStatus] = useState("idle");

  const handleSignRecognized = useCallback((result: SignRecognitionResult) => {
    setRecognizedSigns((prev) => [
      ...prev,
      {
        sign: result.sign,
        confidence: result.confidence,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const handleClear = useCallback(() => {
    setRecognizedSigns([]);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-subtle flex flex-col">
      {/* Header */}
      <header className="px-6 py-6 flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-3">
              <div className="bg-blue-950 p-2 rounded-full">
                <Accessibility className="h-6 w-6 text-orange-500" />
              </div>
              <h1 className="text-3xl font-bold bg-clip-text text-blue-900">
                SignBridge AI
              </h1>
            </div>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Sign language recognition with real-time text and speech output
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 flex-1 flex flex-col">
        <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col">
          {/* Two Column Content */}
          <div className="grid lg:grid-cols-2 gap-6 flex-1 min-h-0">
            {/* Left Column - Webcam and Controls */}
            <div className="space-y-3 overflow-y-auto min-h-0">
              <WebcamCapture
                onSignRecognized={handleSignRecognized}
                onStatusChange={setCaptureStatus}
              />
            </div>

            {/* Right Column - Recognized Signs */}
            <div className="space-y-3 overflow-y-auto min-h-0">
              <RecognizedSignsDisplay
                signs={recognizedSigns}
                isVisible={true}
                onClear={handleClear}
                autoSpeak={true}
              />
            </div>
          </div>

          {/* How It Works */}
          <div className="mt-4 flex-shrink-0">
            <Card className="p-4 bg-card/30 backdrop-blur-sm">
              <h3 className="text-lg font-semibold mb-3 text-center">
                How It Works
              </h3>
              <div className="grid grid-cols-3 gap-6 text-center">
                <div className="space-y-2">
                  <div className="bg-primary/10 w-10 h-10 rounded-full flex items-center justify-center mx-auto">
                    <Camera className="h-5 w-5 text-primary" />
                  </div>
                  <h4 className="font-medium">Start Camera</h4>
                  <p className="text-sm text-muted-foreground">
                    Click Start and allow camera access - AI tracks your hands
                    automatically
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="bg-primary/10 w-10 h-10 rounded-full flex items-center justify-center mx-auto">
                    <Hand className="h-5 w-5 text-primary" />
                  </div>
                  <h4 className="font-medium">Sign a Word</h4>
                  <p className="text-sm text-muted-foreground">
                    Perform an ASL sign, then pause briefly - the system detects
                    when you stop
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="bg-primary/10 w-10 h-10 rounded-full flex items-center justify-center mx-auto">
                    <Volume2 className="h-5 w-5 text-primary" />
                  </div>
                  <h4 className="font-medium">Hear Translation</h4>
                  <p className="text-sm text-muted-foreground">
                    Recognized signs appear as text and are spoken aloud
                    automatically
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

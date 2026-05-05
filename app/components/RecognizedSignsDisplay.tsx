"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Hand, Copy, CheckCircle, Volume2, Trash2 } from "lucide-react";

interface RecognizedSign {
  sign: string;
  confidence: number;
  timestamp: number;
}

interface RecognizedSignsDisplayProps {
  signs: RecognizedSign[];
  isVisible: boolean;
  onClear?: () => void;
  autoSpeak?: boolean;
}

export function RecognizedSignsDisplay({
  signs,
  isVisible,
  onClear,
  autoSpeak = false,
}: RecognizedSignsDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const text = signs.map((s) => s.sign).join(" ");
  const hasContent = signs.length > 0;

  // Trigger animation on new sign
  useEffect(() => {
    if (signs.length > 0 && isVisible) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 500);
      return () => clearTimeout(timer);
    }
  }, [signs.length, isVisible]);

  // Auto-speak on new sign
  useEffect(() => {
    if (autoSpeak && signs.length > 0 && window.speechSynthesis) {
      const latest = signs[signs.length - 1];
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(latest.sign);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  }, [signs.length, autoSpeak]);

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  const handleSpeak = () => {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <Card
      className={`w-full transition-all duration-300 ${
        isAnimating ? "scale-[1.02] shadow-md" : "scale-100"
      } bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <div className="bg-amber-100 p-1.5 rounded">
              <Hand className="h-4 w-4 text-amber-600" />
            </div>
            <span className="text-amber-900">Recognized Signs</span>
          </div>
          <div className="flex items-center gap-1">
            {hasContent ? (
              <Badge
                variant="default"
                className="bg-green-100 text-green-700 border-green-200 text-xs"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                {signs.length} sign{signs.length !== 1 ? "s" : ""}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-gray-50 text-gray-500 border-gray-200 text-xs"
              >
                Waiting...
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Sign badges */}
        <div className="bg-white/70 backdrop-blur-sm p-3 rounded border border-amber-100 min-h-[60px]">
          {hasContent ? (
            <div className="flex flex-wrap gap-2">
              {signs.map((s, i) => (
                <Badge
                  key={`${s.sign}-${s.timestamp}-${i}`}
                  className="bg-amber-100 text-amber-800 border-amber-300 text-sm px-3 py-1"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {s.sign}
                  <span className="ml-1 text-amber-500 text-xs">
                    {(s.confidence * 100).toFixed(0)}%
                  </span>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm italic text-center">
              Start signing to see recognized words here...
            </p>
          )}
        </div>

        {/* Full sentence text */}
        {hasContent && (
          <div className="bg-white/70 backdrop-blur-sm p-3 rounded border border-amber-100">
            <p className="text-gray-800 text-sm leading-relaxed">
              &quot;{text}&quot;
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <div className="text-xs text-gray-600">
            {hasContent
              ? `${signs.length} word${signs.length !== 1 ? "s" : ""} - ${text.length} chars`
              : "No signs recognized yet"}
          </div>

          {hasContent && (
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSpeak}
                className="border-amber-200 hover:bg-amber-50 h-7 px-2 text-xs"
              >
                <Volume2 className="h-3 w-3 mr-1" />
                Speak
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="border-amber-200 hover:bg-amber-50 h-7 px-2 text-xs"
              >
                {copied ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={onClear}
                className="border-red-200 hover:bg-red-50 h-7 px-2 text-xs text-red-600"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

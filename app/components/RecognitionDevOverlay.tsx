"use client";

import React from "react";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Progress } from "@/app/components/ui/progress";
import type { EngineDebugSnapshot } from "@/app/lib/sign-recognition/recognition-engine";

interface Props {
  debug: EngineDebugSnapshot | null;
  visible: boolean;
}

const STATE_COLORS: Record<string, string> = {
  IDLE: "bg-gray-500",
  WATCHING: "bg-blue-500",
  INFERRING: "bg-purple-500",
  EMITTING: "bg-green-500",
  COOLDOWN: "bg-amber-500",
};

export function RecognitionDevOverlay({ debug, visible }: Props) {
  if (!visible || !debug) return null;

  const bufferPct = (debug.bufferSize / debug.bufferCapacity) * 100;
  const handPct = debug.handPresence * 100;

  return (
    <Card className="p-3 bg-slate-900 text-white text-xs space-y-2 border-slate-700">
      <div className="flex items-center justify-between">
        <Badge className={`${STATE_COLORS[debug.state] ?? "bg-gray-600"} text-white`}>
          {debug.state}
        </Badge>
        <div className="text-slate-300">
          {debug.inferenceInFlight ? "running..." : `last: ${debug.lastInferenceMs.toFixed(0)}ms`}
        </div>
      </div>

      <div>
        <div className="flex justify-between text-slate-400">
          <span>Buffer</span>
          <span>{debug.bufferSize}/{debug.bufferCapacity}</span>
        </div>
        <Progress value={bufferPct} className="h-1" />
      </div>

      <div>
        <div className="flex justify-between text-slate-400">
          <span>Hand presence</span>
          <span>{handPct.toFixed(0)}%</span>
        </div>
        <Progress value={handPct} className="h-1" />
      </div>

      <div className="flex justify-between text-slate-400">
        <span>Stable ticks: {debug.stableTicks}</span>
        {debug.cooldownRemainingMs > 0 && (
          <span>Cooldown: {debug.cooldownRemainingMs.toFixed(0)}ms</span>
        )}
      </div>

      <div className="border-t border-slate-700 pt-1.5">
        <div className="text-slate-400 mb-1">Top 5 (EMA)</div>
        <div className="space-y-0.5">
          {debug.topK.map((k, i) => {
            const pct = k.prob * 100;
            return (
              <div key={`${k.classIndex}-${i}`} className="flex items-center gap-2">
                <span className="w-20 truncate font-mono text-slate-200">{k.sign}</span>
                <div className="flex-1 bg-slate-800 rounded h-2 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <span className="w-10 text-right text-slate-300">{pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

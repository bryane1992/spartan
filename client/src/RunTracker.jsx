import { useState, useEffect, useRef, useCallback } from "react";

const F = { h: "'Oswald',sans-serif", m: "'JetBrains Mono',monospace" };

// Run types configuration
const RUN_CONFIGS = {
  INTERVALS: {
    name: "INTERVAL RUN",
    segments: [
      { name: "Warm-up", duration: 300, type: "easy" }, // 5 min
      { name: "Hard Run", duration: 120, type: "hard", repeat: true }, // 2 min
      { name: "Recovery", duration: 60, type: "recovery", repeat: true }, // 1 min
      { name: "Cool-down", duration: 300, type: "easy" } // 5 min
    ]
  },
  TEMPO: {
    name: "TEMPO RUN",
    segments: [
      { name: "Warm-up", duration: 300, type: "easy" },
      { name: "Tempo Run", duration: 1200, type: "tempo" }, // 20 min
      { name: "Cool-down", duration: 300, type: "easy" }
    ]
  },
  LONG_RUN: {
    name: "LONG RUN", 
    segments: [
      { name: "Steady Run", duration: 3600, type: "steady" } // 60 min max (user stops when done)
    ]
  },
  LONG: {
    name: "LONG RUN", 
    segments: [
      { name: "Steady Run", duration: 3600, type: "steady" } // 60 min max
    ]
  },
  FARTLEK: {
    name: "FARTLEK RUN",
    segments: [
      { name: "Warm-up", duration: 300, type: "easy" },
      { name: "Variable Pace", duration: 1500, type: "fartlek" }, // 25 min
      { name: "Cool-down", duration: 300, type: "easy" }
    ]
  }
};

export default function RunTracker({ runType = "INTERVALS", rounds = 4, onComplete }) {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSegment, setCurrentSegment] = useState(0);
  const [segmentTime, setSegmentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [segments, setSegments] = useState([]);
  const [completedSplits, setCompletedSplits] = useState([]);
  const [gpsError, setGpsError] = useState(null);
  const [currentRound, setCurrentRound] = useState(1);

  const watchId = useRef(null);
  const lastPosition = useRef(null);
  const segmentDistance = useRef(0);
  const audioRef = useRef(null);
  const intervalRef = useRef(null);

  // Build segment list based on run type and rounds
  useEffect(() => {
    const config = RUN_CONFIGS[runType];
    if (!config) {
      console.error(`Unknown run type: ${runType}`);
      return;
    }
    
    let fullSegments = [];
    
    if (runType === "LONG_RUN" || runType === "LONG") {
      // For long runs, just one continuous segment
      fullSegments = config.segments;
    } else {
      config.segments.forEach(seg => {
        if (seg.repeat && runType === "INTERVALS") {
          // Add repeated intervals
          for (let i = 0; i < rounds; i++) {
            fullSegments.push(
              { ...seg, name: `${seg.name} ${i + 1}/${rounds}`, round: i + 1 },
              { ...config.segments[2], name: `Recovery ${i + 1}/${rounds}`, round: i + 1 }
            );
          }
        } else if (!seg.repeat) {
          fullSegments.push(seg);
        }
      });
    }

    setSegments(fullSegments);
  }, [runType, rounds]);

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format distance
  const formatDistance = (meters) => {
    const miles = meters * 0.000621371;
    return miles.toFixed(2);
  };

  // Calculate distance between two GPS points
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  // Play audio cue
  const playAudioCue = (message) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 1.2;
      speechSynthesis.speak(utterance);
    }
  };

  // Handle GPS tracking
  const startGPSTracking = () => {
    if ("geolocation" in navigator) {
      watchId.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, speed } = position.coords;
          
          if (lastPosition.current) {
            const distance = calculateDistance(
              lastPosition.current.lat,
              lastPosition.current.lon,
              latitude,
              longitude
            );
            
            if (distance < 1000) { // Ignore jumps > 1km (GPS errors)
              setTotalDistance(prev => prev + distance);
              segmentDistance.current += distance;
            }
          }
          
          lastPosition.current = { lat: latitude, lon: longitude };
          setCurrentSpeed(speed ? speed * 2.237 : 0); // Convert m/s to mph
          setGpsError(null);
        },
        (error) => {
          setGpsError(error.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    } else {
      setGpsError("GPS not available");
    }
  };

  // Stop GPS tracking
  const stopGPSTracking = () => {
    if (watchId.current) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  };

  // Handle segment transitions
  const nextSegment = useCallback(() => {
    const currentSeg = segments[currentSegment];
    
    // Log completed segment
    const splitData = {
      name: currentSeg.name,
      time: segmentTime,
      distance: segmentDistance.current,
      pace: segmentDistance.current > 0 ? (segmentTime / 60) / formatDistance(segmentDistance.current) : 0,
      type: currentSeg.type
    };
    
    setCompletedSplits(prev => [...prev, splitData]);
    
    // Reset segment tracking
    segmentDistance.current = 0;
    setSegmentTime(0);
    
    // Move to next segment
    if (currentSegment < segments.length - 1) {
      const nextSeg = segments[currentSegment + 1];
      setCurrentSegment(prev => prev + 1);
      
      // Audio cue for next segment
      playAudioCue(`Starting ${nextSeg.name}. ${nextSeg.type === 'hard' ? 'Pick up the pace!' : nextSeg.type === 'recovery' ? 'Easy pace, recover.' : 'Maintain steady pace.'}`);
    } else {
      // Run complete
      stopRun();
    }
  }, [currentSegment, segments, segmentTime]);

  // Timer effect
  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        setTotalTime(prev => prev + 1);
        setSegmentTime(prev => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, isPaused]);
  
  // Check for segment transitions
  useEffect(() => {
    const currentSeg = segments[currentSegment];
    if (currentSeg && segmentTime >= currentSeg.duration && isRunning && !isPaused) {
      nextSegment();
    }
  }, [segmentTime, currentSegment, segments, isRunning, isPaused, nextSegment]);

  // Start run
  const startRun = () => {
    setIsRunning(true);
    setIsPaused(false);
    startGPSTracking();
    playAudioCue(`Starting ${segments[0].name}. Let's go!`);
  };

  // Pause/Resume
  const togglePause = () => {
    setIsPaused(!isPaused);
    if (isPaused) {
      startGPSTracking();
      playAudioCue("Resuming run");
    } else {
      stopGPSTracking();
      playAudioCue("Run paused");
    }
  };

  // Stop run
  const stopRun = () => {
    setIsRunning(false);
    setIsPaused(false);
    stopGPSTracking();
    playAudioCue("Run complete! Great work!");
    
    // Prepare summary data
    const summary = {
      type: runType,
      totalTime,
      totalDistance,
      avgPace: totalDistance > 0 ? (totalTime / 60) / formatDistance(totalDistance) : 0,
      splits: completedSplits
    };
    
    if (onComplete) {
      onComplete(summary);
    }
  };

  // Skip to next segment manually
  const skipSegment = () => {
    nextSegment();
  };

  const currentSeg = segments[currentSegment];
  const segmentProgress = currentSeg ? (segmentTime / currentSeg.duration) * 100 : 0;

  return (
    <div style={{ padding: 14, background: "#0A0A0A", minHeight: "100vh", color: "#fff", fontFamily: F.h }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 1, marginBottom: 5 }}>
          {RUN_CONFIGS[runType].name}
        </div>
        <div style={{ fontFamily: F.m, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          {gpsError ? `GPS: ${gpsError}` : `GPS: Active • ${currentSpeed.toFixed(1)} mph`}
        </div>
      </div>

      {!isRunning ? (
        // Start screen
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ marginBottom: 30 }}>
            <div style={{ fontFamily: F.m, fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 20 }}>
              Ready to run {segments.length} segments
            </div>
            {segments.slice(0, 5).map((seg, i) => (
              <div key={i} style={{ 
                padding: "8px 12px", 
                background: "rgba(255,255,255,0.03)", 
                borderRadius: 6, 
                marginBottom: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <span style={{ fontFamily: F.h, fontSize: 13 }}>{seg.name}</span>
                <span style={{ fontFamily: F.m, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                  {formatTime(seg.duration)}
                </span>
              </div>
            ))}
            {segments.length > 5 && (
              <div style={{ fontFamily: F.m, fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 5 }}>
                +{segments.length - 5} more segments
              </div>
            )}
          </div>
          
          <button 
            onClick={startRun}
            style={{
              padding: "16px 48px",
              background: "#FF4136",
              border: "none",
              borderRadius: 8,
              fontFamily: F.h,
              fontSize: 18,
              fontWeight: 600,
              color: "#fff",
              cursor: "pointer",
              letterSpacing: 1
            }}
          >
            START RUN
          </button>
        </div>
      ) : (
        // Running screen
        <div>
          {/* Current segment info */}
          <div style={{ marginBottom: 25 }}>
            <div style={{ 
              padding: 20, 
              background: currentSeg?.type === 'hard' ? "rgba(255,65,54,0.1)" : 
                         currentSeg?.type === 'recovery' ? "rgba(255,220,0,0.1)" : 
                         "rgba(1,255,112,0.1)",
              borderRadius: 10,
              border: `2px solid ${currentSeg?.type === 'hard' ? "#FF4136" : 
                                   currentSeg?.type === 'recovery' ? "#FFDC00" : 
                                   "#01FF70"}`
            }}>
              <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
                {currentSeg?.name || ""}
              </div>
              <div style={{ fontSize: 48, fontWeight: 700, fontFamily: F.m, marginBottom: 10 }}>
                {formatTime(segmentTime)}
              </div>
              <div style={{ height: 8, background: "rgba(0,0,0,0.3)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ 
                  height: "100%", 
                  width: `${segmentProgress}%`, 
                  background: currentSeg?.type === 'hard' ? "#FF4136" : 
                             currentSeg?.type === 'recovery' ? "#FFDC00" : 
                             "#01FF70",
                  transition: "width 1s linear"
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                <span style={{ fontFamily: F.m, fontSize: 12 }}>
                  {formatTime(currentSeg?.duration - segmentTime)} remaining
                </span>
                <span style={{ fontFamily: F.m, fontSize: 12 }}>
                  {formatDistance(segmentDistance.current)} mi
                </span>
              </div>
            </div>
          </div>

          {/* Total stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            <div style={{ padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
              <div style={{ fontFamily: F.m, fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
                TOTAL TIME
              </div>
              <div style={{ fontSize: 24, fontWeight: 600 }}>{formatTime(totalTime)}</div>
            </div>
            <div style={{ padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
              <div style={{ fontFamily: F.m, fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
                TOTAL DISTANCE
              </div>
              <div style={{ fontSize: 24, fontWeight: 600 }}>{formatDistance(totalDistance)} mi</div>
            </div>
          </div>

          {/* Completed splits */}
          {completedSplits.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: F.h, fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
                COMPLETED SPLITS
              </div>
              <div style={{ maxHeight: 150, overflowY: "auto" }}>
                {completedSplits.map((split, i) => (
                  <div key={i} style={{ 
                    display: "flex", 
                    justifyContent: "space-between",
                    padding: "6px 10px",
                    background: "rgba(255,255,255,0.02)",
                    borderRadius: 5,
                    marginBottom: 5,
                    fontSize: 12,
                    fontFamily: F.m
                  }}>
                    <span>{split.name}</span>
                    <span>{formatTime(split.time)} • {formatDistance(split.distance)} mi</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Controls */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={togglePause}
              style={{
                flex: 1,
                padding: "14px 20px",
                background: isPaused ? "#01FF70" : "#FF851B",
                border: "none",
                borderRadius: 8,
                fontFamily: F.h,
                fontSize: 16,
                fontWeight: 600,
                color: isPaused ? "#000" : "#fff",
                cursor: "pointer"
              }}
            >
              {isPaused ? "RESUME" : "PAUSE"}
            </button>
            
            <button
              onClick={skipSegment}
              style={{
                padding: "14px 20px",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 8,
                fontFamily: F.h,
                fontSize: 16,
                fontWeight: 600,
                color: "#fff",
                cursor: "pointer"
              }}
            >
              SKIP →
            </button>
            
            <button
              onClick={stopRun}
              style={{
                padding: "14px 20px",
                background: "#FF4136",
                border: "none",
                borderRadius: 8,
                fontFamily: F.h,
                fontSize: 16,
                fontWeight: 600,
                color: "#fff",
                cursor: "pointer"
              }}
            >
              STOP
            </button>
          </div>

          {/* Upcoming segments */}
          <div style={{ marginTop: 20, padding: 10, background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
            <div style={{ fontFamily: F.m, fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 5 }}>
              UP NEXT
            </div>
            {segments.slice(currentSegment + 1, currentSegment + 3).map((seg, i) => (
              <div key={i} style={{ fontSize: 11, fontFamily: F.m, marginBottom: 3 }}>
                {seg.name} • {formatTime(seg.duration)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
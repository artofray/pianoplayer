import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Play, ImagePlus, Loader2, Wand2, X, EyeOff, Save, LogOut } from 'lucide-react';
import { useWebcam } from './hooks/useWebcam';
import { useAuth } from './hooks/useAuth';
import { saveScene, getUserScenes, Scene } from './lib/api';
import { MotionDetector } from './lib/MotionDetector';
import { generateProjectionImage } from './lib/gemini';
import InteractiveCanvas from './components/InteractiveCanvas';
import { synth } from './lib/synth';

// C Major Scale
const KEYS = [
  { note: 'C4', freq: 261.63, color: 'bg-red-500' },
  { note: 'D4', freq: 293.66, color: 'bg-orange-500' },
  { note: 'E4', freq: 329.63, color: 'bg-yellow-500' },
  { note: 'F4', freq: 349.23, color: 'bg-green-500' },
  { note: 'G4', freq: 392.00, color: 'bg-blue-500' },
  { note: 'A4', freq: 440.00, color: 'bg-indigo-500' },
  { note: 'B4', freq: 493.88, color: 'bg-fuchsia-500' },
  { note: 'C5', freq: 523.25, color: 'bg-pink-500' },
];

const COOLDOWN_MS = 600;

export default function App() {
  const { user, loginWithGoogle, logout, isLoading: authLoading } = useAuth();
  const { videoRef, start, isActive, error } = useWebcam();
  
  const [hasStarted, setHasStarted] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  
  const [flipX, setFlipX] = useState(false);
  const [threshold, setThreshold] = useState(15);
  
  const [effectMode, setEffectMode] = useState<'reveal' | 'particles' | 'ripples'>('reveal');
  const [prompt, setPrompt] = useState('A vibrant cyberpunk city street at night with glowing neon signs and rain puddles.');
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const [activeSegment, setActiveSegment] = useState<'create' | 'library' | 'saved'>('create');
  const [savedScenes, setSavedScenes] = useState<Scene[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [sceneName, setSceneName] = useState('My Awesome Scene');

  const [showPianoOverlay, setShowPianoOverlay] = useState(true);
  const activeKeysRef = useRef<number[]>(new Array(KEYS.length).fill(0));
  const [activeVisuals, setActiveVisuals] = useState<boolean[]>(new Array(KEYS.length).fill(false));

  const detectorRef = useRef<MotionDetector | null>(null);

  const startSystem = async () => {
    synth.init();
    await start();
    setHasStarted(true);
    detectorRef.current = new MotionDetector(160, 120);
  };

  const handleMotion = (points: {x: number, y: number, intensity: number}[]) => {
    if (!showPianoOverlay) return;

    const now = performance.now();
    const hitKeys = new Set<number>();
    
    points.forEach(p => {
      // Map X coordinate to one of the 8 keys
      const keyIndex = Math.floor(p.x * KEYS.length);
      const clamped = Math.max(0, Math.min(KEYS.length - 1, keyIndex));
      hitKeys.add(clamped);
    });

    let visualChanges: number[] = [];
    
    hitKeys.forEach(i => {
      if (now - activeKeysRef.current[i] > COOLDOWN_MS) {
        synth.playNote(KEYS[i].freq, 'triangle');
        activeKeysRef.current[i] = now;
        visualChanges.push(i);
        
        setTimeout(() => {
          setActiveVisuals(prev => {
            const next = [...prev];
            next[i] = false;
            return next;
          });
        }, 300);
      }
    });

    if (visualChanges.length > 0) {
      setActiveVisuals(prev => {
        const next = [...prev];
        visualChanges.forEach(idx => next[idx] = true);
        return next;
      });
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setGenError(null);
    try {
      const url = await generateProjectionImage(prompt);
      setBackgroundImage(url);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Unknown generation error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveScene = async () => {
    if (!user) {
      return loginWithGoogle();
    }
    
    setIsSaving(true);
    try {
      await saveScene({
        name: sceneName,
        prompt,
        imageUrl: backgroundImage || '',
        effectMode,
        threshold,
        objects: [] // no 3D objects yet
      });
      alert('Scene Saved!');
    } catch (err) {
      console.error(err);
      alert('Error saving scene');
    } finally {
      setIsSaving(false);
    }
  };

  const loadScenes = async () => {
    if (!user) return;
    const scenes = await getUserScenes();
    if(scenes) setSavedScenes(scenes);
  };

  if (!hasStarted) {
    return (
      <div className="flex bg-neutral-950 min-h-screen text-white items-center justify-center flex-col p-8">
        <Wand2 className="w-16 h-16 text-indigo-500 mb-6" />
        <h1 className="text-5xl font-sans tracking-tight font-bold mb-4">Interactive AI Projection</h1>
        <p className="text-neutral-400 max-w-lg text-center mb-10 text-lg leading-relaxed">
          Create massive generated visuals and interact with them using computer vision. Project this onto a wall or floor!
        </p>
        <button 
          onClick={startSystem}
          className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-10 rounded-full transition-all hover:scale-105 shadow-[0_0_40px_rgba(79,70,229,0.4)]"
        >
          <Play className="w-6 h-6 fill-current" />
          START ENGINE
        </button>
        {error && <p className="text-red-500 mt-6 text-sm font-mono border border-red-500/30 bg-red-500/10 p-3 rounded-lg">{error.message}</p>}
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans select-none">
      
      {/* Hidden processing video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="hidden"
      />

      {/* The Magic Canvas */}
      <InteractiveCanvas 
        videoRef={videoRef}
        detectorRef={detectorRef}
        backgroundImage={backgroundImage}
        effectMode={effectMode}
        motionThreshold={threshold}
        flipX={flipX}
        onMotion={handleMotion}
      />

      {/* Piano Overlay */}
      {showPianoOverlay && (
        <div className="absolute inset-0 z-20 w-full h-full flex pt-8 pb-32 px-4 gap-2 pointer-events-none mix-blend-screen">
          {KEYS.map((key, i) => (
            <div key={key.note} className="flex-1 flex flex-col justify-end">
              <motion.div
                initial={false}
                animate={{
                  backgroundColor: activeVisuals[i] ? undefined : 'rgba(255, 255, 255, 0.05)',
                  height: activeVisuals[i] ? '100%' : '20%',
                  boxShadow: activeVisuals[i] ? `0 0 50px ${key.color.replace('bg-', '')}` : 'none',
                }}
                className={`w-full rounded-2xl flex items-end justify-center pb-8 border border-white/10 transition-colors duration-75 ${activeVisuals[i] ? key.color : 'bg-transparent'}`}
              >
                <span className={`text-2xl font-bold transition-opacity ${activeVisuals[i] ? 'text-white opacity-100' : 'opacity-0'}`}>
                  {key.note}
                </span>
              </motion.div>
            </div>
          ))}
        </div>
      )}

      {/* Settings Toggle Trigger Area (Top Right) */}
      {!showSettings && (
        <div 
          className="absolute top-4 right-4 z-50 p-4 opacity-30 hover:opacity-100 transition-opacity cursor-pointer group"
          onClick={() => setShowSettings(true)}
        >
          <Settings className="w-8 h-8 text-white drop-shadow-lg group-hover:rotate-90 transition-transform" />
        </div>
      )}

      {/* Overlay UI (The Control Panel) */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="absolute top-0 right-0 z-50 h-full w-96 bg-neutral-900/95 backdrop-blur-xl border-l border-white/10 p-6 flex flex-col overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-400" /> Control Deck
              </h2>
              <div className="flex gap-2">
                {user && (
                    <button onClick={logout} className="p-2 hover:bg-white/10 rounded-full transition-colors text-neutral-400 hover:text-white" title="Logout">
                       <LogOut className="w-5 h-5" />
                    </button>
                )}
                <button 
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-neutral-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex gap-2 mb-6 bg-black/40 p-1 rounded-lg">
              <button 
                onClick={() => setActiveSegment('create')}
                className={`flex-1 py-1 text-sm rounded-md transition-colors ${activeSegment === 'create' ? 'bg-white/20 text-white' : 'text-neutral-400'}`}
              >
                Create
              </button>
              <button 
                onClick={() => { setActiveSegment('saved'); loadScenes(); }}
                className={`flex-1 py-1 text-sm rounded-md transition-colors ${activeSegment === 'saved' ? 'bg-white/20 text-white' : 'text-neutral-400'}`}
              >
                Saved Scenes
              </button>
              <button 
                onClick={() => setActiveSegment('library')}
                className={`flex-1 py-1 text-sm rounded-md transition-colors ${activeSegment === 'library' ? 'bg-white/20 text-white' : 'text-neutral-400'}`}
              >
                3D Library
              </button>
            </div>
            
            <div className="space-y-8">
              
              {activeSegment === 'create' && (
                <>
                  {/* --- IMAGE GENERATION --- */}
                  <section className="space-y-4">
                <h3 className="text-sm font-semibold tracking-widest text-neutral-500 uppercase">1. Scene Generator</h3>
                
                <div className="space-y-3">
                  <textarea 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe your projection scene..."
                    className="w-full h-24 bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                  />
                  <button 
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-medium py-3 px-4 rounded-xl transition-colors"
                  >
                    {isGenerating ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Generating Voxel Map...</>
                    ) : (
                      <><ImagePlus className="w-4 h-4" /> Generate Background</>
                    )}
                  </button>
                  {genError && <p className="text-red-400 text-xs mt-2">{genError}</p>}
                </div>
              </section>

              {/* --- INTERACTIVE BEHAVIOR --- */}
              <section className="space-y-4">
                <h3 className="text-sm font-semibold tracking-widest text-neutral-500 uppercase">2. Vision & Effects</h3>
                
                <div className="space-y-2">
                  <label className="text-xs text-neutral-400 block mb-2">Effect Style</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['reveal', 'particles', 'ripples'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setEffectMode(mode)}
                        className={`py-2 px-1 text-xs rounded-lg capitalize transition-colors ${effectMode === mode ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-neutral-400 hover:bg-white/10'}`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-4 bg-black/20 p-4 rounded-xl border border-white/5">
                  <label className="flex justify-between text-xs text-neutral-400 mb-2">
                    <span>Motion Sensitivity</span>
                    <span className="text-indigo-400 text-mono">{threshold}</span>
                  </label>
                  <input 
                    type="range" 
                    min="5" max="100" 
                    value={threshold} 
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
                    <span>Too Random</span>
                    <span>Needs Big Movement</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm text-neutral-300">Mirror Tracking Feed</span>
                  <button 
                    onClick={() => setFlipX(!flipX)}
                    className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${flipX ? 'bg-indigo-600' : 'bg-neutral-700'}`}
                  >
                    <motion.div 
                      layout
                      className="w-4 h-4 bg-white rounded-full shadow-md"
                      animate={{ x: flipX ? 24 : 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-4">
                  <div className="space-y-1">
                     <span className="text-sm text-neutral-300 block">Piano Keys & Synth</span>
                     <span className="text-xs text-neutral-500 block">Play notes when stepping</span>
                  </div>
                  <button 
                    onClick={() => setShowPianoOverlay(!showPianoOverlay)}
                    className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${showPianoOverlay ? 'bg-indigo-600' : 'bg-neutral-700'}`}
                  >
                    <motion.div 
                      layout
                      className="w-4 h-4 bg-white rounded-full shadow-md"
                      animate={{ x: showPianoOverlay ? 24 : 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
              </section>

              <section className="space-y-4 border-t border-white/10 pt-6">
                <h3 className="text-sm font-semibold tracking-widest text-neutral-500 uppercase">3. Save Scene</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={sceneName}
                    onChange={e => setSceneName(e.target.value)}
                    placeholder="Scene Name"
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button 
                    onClick={handleSaveScene}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl transition-colors border border-white/10"
                  >
                   {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                   {user ? 'Save Scene' : 'Login & Save'}
                  </button>
                </div>
              </section>

              </>
             )}

             {activeSegment === 'saved' && (
                 <div className="space-y-4">
                    {user ? (
                        savedScenes.length > 0 ? (
                           savedScenes.map(scene => (
                              <div key={scene.id} className="bg-black/40 border border-white/10 p-3 rounded-xl flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer"
                                onClick={() => {
                                  setPrompt(scene.prompt);
                                  setBackgroundImage(scene.imageUrl);
                                  setEffectMode(scene.effectMode);
                                  setThreshold(scene.threshold);
                                }}
                              >
                                <div>
                                  <div className="text-white text-sm font-bold">{scene.name}</div>
                                  <div className="text-neutral-500 text-xs mt-1 capitalize">{scene.effectMode} mode</div>
                                </div>
                                {scene.imageUrl && (
                                   <div className="w-12 h-12 rounded-md overflow-hidden bg-white/10 border border-white/10">
                                      <img src={scene.imageUrl} className="w-full h-full object-cover" />
                                   </div>
                                )}
                              </div>
                           ))
                        ) : (
                          <div className="text-center text-neutral-500 py-10 text-sm">No saved scenes yet.</div>
                        )
                    ) : (
                       <div className="text-center py-10">
                         <p className="text-sm text-neutral-400 mb-4">Login to view and save scenes</p>
                         <button onClick={loginWithGoogle} className="bg-white text-black font-bold py-2 px-6 rounded-full text-sm">
                           Sign In with Google
                         </button>
                       </div>
                    )}
                 </div>
             )}

             {activeSegment === 'library' && (
                 <div className="space-y-4">
                    <p className="text-sm text-neutral-400">
                      The 3D Editable Object library allows you to upload GLTF/GLB models to project into your scenes.
                    </p>
                    <div className="opacity-50 pointer-events-none mt-4 p-4 border border-dashed border-neutral-600 rounded-xl text-center">
                       <p className="text-xs text-neutral-500">Render Engine Integration Pending</p>
                    </div>
                 </div>
             )}

              <div className="mt-8 pt-8 border-t border-white/10 pb-8">
                 <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full flex items-center justify-center gap-2 bg-white text-black hover:bg-neutral-200 font-bold py-4 px-4 rounded-xl transition-colors"
                 >
                   <EyeOff className="w-5 h-5" />
                   HIDE UI FOR PROJECTION
                 </button>
                 <p className="text-xs text-neutral-500 text-center mt-4">Move your mouse to the top right to bring this back.</p>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}


export class Synth {
  context: AudioContext | null = null;
  masterGain: GainNode | null = null;

  init() {
    if (this.context) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
        console.error("AudioContext not supported");
        return;
    }
    this.context = new AudioContextClass();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0.5;
    
    // Add a simple delay for a bit of "magic space" feel
    const delay = this.context.createDelay();
    delay.delayTime.value = 0.25;
    const delayFeedback = this.context.createGain();
    delayFeedback.gain.value = 0.2;
    
    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
    delay.connect(this.masterGain);
    this.masterGain.connect(delay);

    this.masterGain.connect(this.context.destination);
    
    // Resume context if needed (sometimes required by browsers)
    if (this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  playNote(frequency: number, type: OscillatorType = 'triangle') {
    if (!this.context || !this.masterGain) return;
    
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, this.context.currentTime);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    
    // Attack / Decay / Sustain / Release
    gain.gain.setValueAtTime(0, this.context.currentTime);
    gain.gain.linearRampToValueAtTime(1, this.context.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 1.5);
    
    osc.stop(this.context.currentTime + 1.5);
  }
}

export const synth = new Synth();

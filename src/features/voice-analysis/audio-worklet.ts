// AudioWorklet processor for low-latency PCM sample access
// This file must be loaded separately as a worklet module

const BUFFER_SIZE = 4096;

class StressAudioProcessor extends AudioWorkletProcessor {
  private buffer: Float32Array;
  private bufferIndex: number;

  constructor() {
    super();
    this.buffer = new Float32Array(BUFFER_SIZE);
    this.bufferIndex = 0;
  }

  process(inputs: Float32Array[][], _outputs: Float32Array[][], _parameters: Record<string, Float32Array>): boolean {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];

    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.bufferIndex++] = channelData[i];

      if (this.bufferIndex >= BUFFER_SIZE) {
        this.port.postMessage({
          type: 'pcm-data',
          samples: this.buffer.slice(),
          sampleRate: sampleRate,
        });
        this.bufferIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor('stress-audio-processor', StressAudioProcessor);

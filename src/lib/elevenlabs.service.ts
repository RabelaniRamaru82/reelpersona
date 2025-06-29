// ElevenLabs Voice Service for Sensa
export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  preview_url?: string;
}

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

class ElevenLabsService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  private currentAudio: HTMLAudioElement | null = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // Get available voices from ElevenLabs
  async getVoices(): Promise<ElevenLabsVoice[]> {
    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error('Error fetching ElevenLabs voices:', error);
      return [];
    }
  }

  // Get recommended voices for Sensa (deep, calming, professional)
  getRecommendedVoicesForSensa(): { voice_id: string; name: string; description: string }[] {
    return [
      {
        voice_id: 'EXAVITQu4vr4xnSDxMaL', // Bella - warm, engaging
        name: 'Bella',
        description: 'Warm and engaging, perfect for professional conversations'
      },
      {
        voice_id: 'ErXwobaYiN019PkySvjV', // Antoni - deep, calming
        name: 'Antoni',
        description: 'Deep, calming voice ideal for thoughtful discussions'
      },
      {
        voice_id: 'VR6AewLTigWG4xSOukaG', // Arnold - authoritative, warm
        name: 'Arnold',
        description: 'Authoritative yet warm, great for professional guidance'
      },
      {
        voice_id: 'pNInz6obpgDQGcFmaJgB', // Adam - deep, professional
        name: 'Adam',
        description: 'Deep, professional tone perfect for personality analysis'
      },
      {
        voice_id: 'onwK4e9ZLuTAKqWW03F9', // Daniel - calm, reassuring
        name: 'Daniel',
        description: 'Calm and reassuring, excellent for creating safe spaces'
      }
    ];
  }

  // Generate speech from text
  async generateSpeech(
    text: string,
    voiceId: string,
    settings: VoiceSettings = {
      stability: 0.75,
      similarity_boost: 0.75,
      style: 0.5,
      use_speaker_boost: true
    }
  ): Promise<ArrayBuffer> {
    try {
      const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text: this.cleanTextForSpeech(text),
          model_id: 'eleven_monolingual_v1',
          voice_settings: settings,
        }),
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs TTS error: ${response.status}`);
      }

      return await response.arrayBuffer();
    } catch (error) {
      console.error('Error generating speech:', error);
      throw error;
    }
  }

  // Clean text for better speech synthesis
  private cleanTextForSpeech(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove markdown bold
      .replace(/\*(.*?)\*/g, '$1') // Remove markdown italic
      .replace(/`(.*?)`/g, '$1') // Remove code blocks
      .replace(/#{1,6}\s/g, '') // Remove markdown headers
      .replace(/\n+/g, '. ') // Replace line breaks with pauses
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/([.!?])\s*([A-Z])/g, '$1 $2') // Ensure proper pauses between sentences
      .trim();
  }

  // Play audio from ArrayBuffer
  async playAudio(audioBuffer: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Stop any currently playing audio
        this.stopAudio();

        const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(blob);
        
        this.currentAudio = new Audio(audioUrl);
        
        this.currentAudio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          resolve();
        };
        
        this.currentAudio.onerror = (error) => {
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          reject(error);
        };
        
        this.currentAudio.play();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Stop currently playing audio
  stopAudio(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }

  // Check if audio is currently playing
  isPlaying(): boolean {
    return this.currentAudio !== null && !this.currentAudio.paused;
  }

  // Get current audio duration and position
  getAudioStatus(): { duration: number; currentTime: number; isPlaying: boolean } {
    if (this.currentAudio) {
      return {
        duration: this.currentAudio.duration || 0,
        currentTime: this.currentAudio.currentTime || 0,
        isPlaying: !this.currentAudio.paused
      };
    }
    return { duration: 0, currentTime: 0, isPlaying: false };
  }

  // Test voice with a sample message
  async testVoice(voiceId: string, settings?: VoiceSettings): Promise<void> {
    const testMessage = "Hello. I'm Sensa, your AI personality analyst. My voice is designed to be calming and professional as we explore your deeper motivations together. This is how I sound when we have our conversation.";
    
    try {
      const audioBuffer = await this.generateSpeech(testMessage, voiceId, settings);
      await this.playAudio(audioBuffer);
    } catch (error) {
      console.error('Error testing voice:', error);
      throw error;
    }
  }
}

// Singleton instance
let elevenLabsService: ElevenLabsService | null = null;

export const initializeElevenLabs = (apiKey: string): ElevenLabsService => {
  elevenLabsService = new ElevenLabsService(apiKey);
  return elevenLabsService;
};

export const getElevenLabsService = (): ElevenLabsService => {
  if (!elevenLabsService) {
    throw new Error('ElevenLabs service not initialized. Call initializeElevenLabs first.');
  }
  return elevenLabsService;
};

export default ElevenLabsService;
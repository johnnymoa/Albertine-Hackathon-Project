import os
from openai import OpenAI
from pathlib import Path
from pydub import AudioSegment
import math
import shutil

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Maximum size in bytes (25MB)
MAX_FILE_SIZE = 25 * 1024 * 1024

def check_ffmpeg():
    """Check if ffmpeg is installed"""
    if not shutil.which('ffmpeg') or not shutil.which('ffprobe'):
        raise RuntimeError(
            "ffmpeg and ffprobe are required but not found. "
            "Please install ffmpeg:\n"
            "- macOS: brew install ffmpeg\n"
            "- Ubuntu/Debian: sudo apt-get install ffmpeg\n"
            "- Windows: choco install ffmpeg"
        )

def split_audio(file_path):
    """Split audio file into chunks smaller than 25MB"""
    # Check for ffmpeg before proceeding
    check_ffmpeg()
    
    try:
        audio = AudioSegment.from_file(file_path)
    except Exception as e:
        raise RuntimeError(f"Error loading audio file: {str(e)}")
    
    # Calculate duration that would result in ~24MB chunks (leaving buffer)
    byte_rate = os.path.getsize(file_path) / len(audio)
    chunk_duration = (24 * 1024 * 1024) / byte_rate
    chunk_duration_ms = math.floor(chunk_duration)
    
    chunks = []
    for i in range(0, len(audio), chunk_duration_ms):
        chunk = audio[i:i + chunk_duration_ms]
        chunk_path = f"temp_chunk_{i}.mp3"
        chunk.export(chunk_path, format="mp3")
        chunks.append(chunk_path)
    
    return chunks

def transcribe_audio(file_path):
    # Check file size
    file_size = os.path.getsize(file_path)
    
    if file_size > MAX_FILE_SIZE:
        print("File is larger than 25MB, splitting into chunks...")
        chunks = split_audio(file_path)
        full_transcript = []
        
        try:
            for chunk in chunks:
                with open(chunk, "rb") as audio:
                    transcript = client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio,
                        response_format="text"
                    )
                    full_transcript.append(transcript)
                # Clean up chunk file
                os.remove(chunk)
            
            # Combine transcripts
            final_transcript = " ".join(full_transcript)
            
        except Exception as e:
            print(f"An error occurred: {str(e)}")
            # Clean up any remaining chunks
            for chunk in chunks:
                if os.path.exists(chunk):
                    os.remove(chunk)
            return None
    else:
        try:
            with open(file_path, "rb") as audio:
                final_transcript = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio,
                    response_format="text"
                )
        except Exception as e:
            print(f"An error occurred: {str(e)}")
            return None
    
    # Save the transcription to a text file
    output_file = Path(file_path).stem + "_transcript.txt"
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(final_transcript)
    
    print(f"Transcription completed and saved to {output_file}")
    return final_transcript

if __name__ == "__main__":
    # Replace with your audio file path
    audio_file_path = "flight_safety.m4a"
    transcribe_audio(audio_file_path) 
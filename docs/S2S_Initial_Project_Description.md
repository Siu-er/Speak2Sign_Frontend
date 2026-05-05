# S2S (Speak2Sign) Framework - Initial Project Description

## 1. Project Overview

S2S is a real-time, bidirectional communication framework that bridges the gap between spoken language and sign language. The framework enables two-way conversation between deaf/hard-of-hearing and hearing individuals through a web-based platform, combining speech recognition, natural language processing, computer vision, and 3D avatar animation into a unified system.

The name "S2S" reflects the dual nature of the system: Speech-to-Sign and Sign-to-Speech, forming a complete communication loop rather than a one-directional tool.

## 2. Problem Statement

There are approximately 70 million deaf people worldwide who use sign language as their primary form of communication. Despite advances in accessibility technology, real-time communication between deaf and hearing individuals remains a significant challenge. Existing solutions are fragmented: speech-to-text tools ignore sign language entirely, while sign language resources are typically educational rather than communicative.

There is currently no unified framework that provides real-time, bidirectional translation between spoken language and sign language in an accessible, web-based format. S2S aims to fill this gap by providing a modular platform that handles both directions of communication within a single interface.

## 3. Project Objectives

- Develop a real-time Speech-to-Sign translation pipeline that converts spoken input into 3D animated sign language
- Develop a complete Sign-to-Speech pipeline that recognizes sign language gestures from camera input and produces spoken/written output
- Support multilingual spoken language input, allowing non-English speakers to communicate with ASL users
- Design a modular, extensible architecture where each pipeline component (ASR, translation, glossing, animation, CV) can be independently developed, tested, and swapped
- Deliver a web-first, mobile-responsive application accessible without installation

## 4. System Architecture

S2S is structured as a modular pipeline with two primary directions of communication.

### 4.1 Speech to Sign (Full Implementation)

This direction converts spoken language into animated sign language through the following stages:

1. **Voice Activity Detection (VAD):** Client-side audio processing detects speech segments in real-time using adaptive energy-based detection, eliminating the need for manual push-to-talk interaction.

2. **Speech Recognition (ASR):** Detected speech segments are transcribed to text. The system supports multiple ASR providers, including OpenAI Whisper (multilingual, supporting English, Japanese, and other languages) and Microsoft Azure Speech Services.

3. **Translation (Multilingual Input):** For non-English speech input, the transcribed text is translated to English before proceeding to the glossing stage. This enables a Japanese speaker, for example, to communicate directly with an ASL user.

4. **Text-to-Gloss Conversion:** English text is converted to ASL gloss notation using rule-based NLP processing with spaCy. This stage handles ASL-specific grammar transformations including:
   - Function word dropping (articles, prepositions)
   - Time fronting (temporal expressions moved to sentence start)
   - Question restructuring (WH-movement, yes/no question inversion)
   - Negation placement
   - Contraction expansion and pattern matching

5. **Gloss-to-SiGML Generation:** ASL gloss tokens are mapped to SiGML (Signing Gesture Markup Language) XML using HamNoSys (Hamburg Notation System), an internationally recognized phonetic transcription system for sign languages. Unknown words are handled through fingerspelling.

6. **3D Avatar Animation:** SiGML markup is rendered as real-time 3D avatar animation using the CWASA (CWA Sign Animation) engine. Users can select from multiple avatar models. The avatar performs the signs with appropriate hand shapes, movements, and non-manual markers.

### 4.2 Sign to Speech (Full Implementation)

This direction captures sign language input through a camera and converts it to spoken/written English:

1. **Video Capture:** Webcam input captures the user performing sign language gestures in real-time.

2. **Hand and Pose Detection:** MediaPipe or similar framework extracts hand landmarks, body pose, and facial expressions from the video feed in real-time.

3. **Sign Recognition:** A trained classifier maps the extracted landmarks to ASL signs. The system aims to cover a conversational vocabulary sufficient for everyday interactions, with the recognition model trained on available ASL datasets and expanded incrementally throughout development.

4. **Text Generation:** Recognized sign sequences are assembled into grammatically correct English text, handling the structural differences between ASL grammar and English word order.

5. **Speech Output:** Generated text is spoken aloud using browser-native Text-to-Speech (TTS) APIs, completing the communication loop back to the hearing user.

### 4.3 Modular Design Principle

Each stage in both pipelines is designed as an independent, swappable component with defined input/output contracts. This allows:
- Individual components to be upgraded without affecting the rest of the pipeline (e.g., replacing Whisper with a faster ASR model)
- Different configurations for different deployment contexts (e.g., on-device ASR for low-connectivity environments)
- Independent testing and evaluation of each stage

## 5. Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js, React, TypeScript | Web application framework |
| UI | Tailwind CSS, shadcn/ui (Radix) | Component library and styling |
| Audio Processing | Web Audio API, AudioWorklet | Client-side VAD and audio capture |
| Speech Recognition | OpenAI Whisper, Azure Speech Services | Multilingual speech-to-text |
| NLP | spaCy, custom rule engine | English-to-ASL gloss conversion |
| Sign Animation | CWASA, SiGML, HamNoSys | 3D avatar rendering |
| Computer Vision | MediaPipe (planned) | Hand/pose detection for Sign-to-Speech |
| Backend | Flask, Python | API server and ML model hosting |
| ML Framework | PyTorch, Hugging Face Transformers | Model inference |

## 6. Scope

### 6.1 In Scope

- Real-time Speech-to-Sign translation with 3D avatar animation (full implementation)
- Multilingual speech input support (English as primary, Japanese and additional languages via Whisper)
- Sign-to-Speech via webcam-based sign recognition (full implementation)
- ASL (American Sign Language) as the target sign language
- Web-based platform, mobile-responsive design
- Multiple avatar selection for sign language output
- Real-time voice activity detection (no manual recording triggers)

### 6.2 Out of Scope

- Sign languages other than ASL (Auslan, BSL, JSL, etc.) -- architecture supports future extension
- Native mobile applications (iOS/Android)
- Offline/on-device operation
- User accounts, authentication, or data persistence
- Production deployment and scaling

## 7. Target Users

- **Deaf/hard-of-hearing individuals** who use ASL and need to communicate with hearing people who do not know sign language
- **Hearing individuals** who need to communicate with deaf/hard-of-hearing ASL users without sign language knowledge
- **Multilingual speakers** who speak languages other than English and need to communicate with ASL users

## 8. Key Deliverables

1. S2S web application with bidirectional translation interface
2. Speech-to-Sign pipeline with multilingual input support
3. Sign-to-Speech pipeline with webcam-based sign recognition
4. Backend API server with modular pipeline endpoints
5. Technical documentation and evaluation report
6. Demonstration scenario showcasing two-way communication (e.g., a simulated service counter interaction)

## 9. Constraints and Assumptions

- Internet connectivity is required (cloud-based ASR and translation services)
- Users have access to a modern web browser with microphone and camera permissions
- ASL gloss coverage is limited by the available lexicon and SiGML sign library
- Sign-to-Speech accuracy is dependent on lighting conditions, camera quality, and signing clarity
- The system targets conversational ASL, not technical or domain-specific signing

## 10. Success Criteria

- Speech-to-Sign pipeline achieves end-to-end latency under 3 seconds for a typical sentence
- Speech-to-Sign produces grammatically acceptable ASL gloss for common conversational sentences
- Sign-to-Speech correctly recognizes signs from the target vocabulary with reasonable accuracy
- The system supports at least 2 spoken input languages (English + one additional)
- A two-way conversation demo can be completed using the platform

## 11. Project Timeline (6 Months)

| Phase | Period | Focus |
|-------|--------|-------|
| Phase 1 | Month 1-2 | Architecture refactoring into S2S framework, multilingual speech input, API contract definition |
| Phase 2 | Month 2-3 | Speech-to-Sign polish (gloss coverage, avatar quality, mobile responsiveness) |
| Phase 3 | Month 3-5 | Sign-to-Speech full pipeline (MediaPipe integration, sign classifier training, vocabulary expansion, TTS output) |
| Phase 4 | Month 5-6 | Integration, evaluation, demonstration scenario, documentation |

# S2S Framework - Business Model Canvas

## Key Partners

- **University / Supervisor**:Provides academic guidance, project oversight, ethics approval for user testing, and access to university infrastructure and computing resources.
- **Microsoft Azure**:Provides Speech Services API for real-time multilingual speech-to-text transcription, a core dependency of the Speech-to-Sign pipeline.
- **OpenAI (Whisper)**:Open-source multilingual speech recognition model used as the primary ASR engine, enabling support for multiple spoken languages.
- **Google MediaPipe**:Pre-trained hand and pose landmark detection framework used in the Sign-to-Speech pipeline for real-time gesture extraction from webcam input.
- **JASigning / CWASA Project**:Provides the 3D avatar animation engine and SiGML/HamNoSys sign representation standards that power the sign language output rendering.
- **Deaf Community Organizations**:Offer domain expertise, feedback on ASL accuracy, and participation in user testing to validate real-world usability.

## Key Activities

- **Speech-to-Sign Pipeline**: Full translation chain from voice input to animated avatar output with multilingual support.
- **Sign-to-Speech Pipeline**: Camera-based sign recognition using CV and a trained classifier for conversational ASL vocabulary.
- **ASL Linguistic Engineering**: Expanding gloss lexicon, grammar rules, and SiGML sign coverage.
- **User Testing**: Structured sessions with deaf and hearing participants.
- **System Integration**: Unifying both directions into a single web interface.

## Key Resources

- **Development Team**: Six members across frontend, backend/NLP, CV, and project management.
- **ASL Sign Library**: 100+ SiGML sign definitions in HamNoSys notation.
- **Cloud APIs**: Azure Speech Services, translation APIs for multilingual support.
- **Pre-trained Models**: Whisper (ASR) and MediaPipe (hand/pose detection).
- **CWASA Avatar Engine**: WebGL-based 3D sign animation with multiple avatars.

## Value Propositions

- **Real-Time Bidirectional Communication**:Enables deaf and hearing individuals to hold a live conversation through a single platform, with speech translated to sign and sign translated to speech.
- **No Sign Language Knowledge Required**:Hearing users simply speak naturally; the system handles all translation and visual representation, removing the learning barrier entirely.
- **Multilingual Speech Input**:Speakers of English, Japanese, and other languages can communicate with ASL users, addressing both the hearing barrier and the language barrier simultaneously.
- **Zero Installation Access**:Runs entirely in the browser with no downloads or plugins, making it immediately accessible from any device with a microphone and camera.
- **Modular and Extensible Architecture**:Each pipeline stage is independently swappable, allowing future expansion to other sign languages (Auslan, BSL) or integration of improved models without rebuilding the system.

## Customer Relationships

- **Self-Service**: Browser-based access, no registration or training needed.
- **Guided Demo**: Built-in walkthrough scenario for first-time users.
- **Community Feedback**: User testing with deaf community shapes priorities.
- **Open Source**: GitHub repository for post-capstone contribution and extension.

## Customer Segments

- **Deaf and Hard-of-Hearing ASL Users**:Individuals who use ASL as their primary language and need to communicate with hearing people who do not know sign language, particularly in everyday service interactions.
- **Frontline Service Workers**:Healthcare receptionists, government office staff, and educators who regularly serve deaf clients but lack sign language skills or access to human interpreters.
- **Multilingual Non-English Speakers**:Individuals who speak languages other than English and need to communicate with ASL users, facing both a language and a hearing barrier.
- **Accessibility Researchers and Developers**:Academic and industry professionals building assistive technology who can use S2S as a reference implementation or integration component.

## Channels

- **University Showcase**: Capstone presentation and live demo day.
- **Web Deployment**: Hosted URL, accessible from any browser.
- **GitHub**: Open-source repository for code and documentation.

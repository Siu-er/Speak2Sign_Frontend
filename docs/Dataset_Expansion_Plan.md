# Speak2Sign Dataset Expansion and Quality Plan

## 1. Purpose

Bring the sign vocabulary, on both the recognition (sign to text) and synthesis
(text to sign) sides, up to production quality for everyday conversational use:
greetings, needs, food and drink, health, money, transport, time, family,
question words, numbers, and common verbs. This document audits the current
state with measured numbers, then lays out options and a phased roadmap.

## 2. Current State Audit

The system runs three independent vocabularies that were each sourced
separately and barely overlap. This is the root problem; the small counts are
symptoms.

### 2.1 Recognition path (sign to text)

- Model: Kaggle GISLR first-place TFLite, served from the backend at
  `/sign-to-text`. The browser streams MediaPipe Holistic landmarks (543 per
  frame) and receives a predicted class.
- Vocabulary: 250 fixed classes. American Sign Language.
- Domain mismatch: the 250 classes are the Google Isolated Sign Language
  Recognition set, which is a parent-and-toddler vocabulary. Representative
  members: alligator, balloon, bee, clown, cowboy, donkey, duck, elephant,
  giraffe, icecream, kitty, lion, owl, pajamas, penny, pig, potty, puppy,
  puzzle, tiger, yucky, zebra, zipper, owie, nap, shhh.
- Everyday-adult coverage inside those 250 is thin. Usable items are roughly:
  hello, bye, please, thankyou, yes, no, food, drink, water, hungry, thirsty,
  time, who, where, why, help is absent, money is absent, numbers are absent,
  name is absent, doctor is absent.
- Granularity: isolated single-sign classification only. No continuous
  sentence-level recognition. Real conversational signing is continuous.

### 2.2 Synthesis path (text to sign)

- Pipeline: spaCy rule glosser (`asl_glosser.py`) plus a `lexicon.json`
  (249 English words to 181 unique glosses) plus a `flan-t5-small` corrector
  that is currently disabled, feeding a SiGML generator (`sigml_generator.py`)
  that renders on the CWASA avatar.
- Sign assets: `data/signs` holds 192 SiGML files = 151 word signs, 26 letters,
  15 numbers. The word signs are British Sign Language (members include bsl,
  britain, england, australia, plus colours and country names).
- Mapping breakage, measured:

  | Metric | Count |
  | --- | --- |
  | Lexicon unique glosses | 181 |
  | Glosses with a real sign asset | 35 |
  | Glosses with no asset (fingerspelled letter by letter) | 146 (81 percent) |
  | Sign assets never referenced by the lexicon (orphans) | 116 |

- Consequence: 81 percent of the words the lexicon knows resolve to a gloss
  with no animation, so the generator spells them out letter by letter. Common
  casualties: eat, drink, help, school, friend, money, every weekday, every
  month, he, she, they, want, need, read, write. Meanwhile 116 real signs
  (coffee, good, colours, question words) are reachable only by accident when a
  word is absent from the lexicon and the glosser happens to uppercase the lemma
  (`asl_glosser.py:291`).

### 2.3 Speech path (audio to text)

- Live model: `openai/whisper-base` with `task=translate`, so any spoken
  language is transcribed to English before glossing. Adequate as a floor.
- The asset download script fetches `whisper-large-v3-turbo`, but the runtime
  loads base. Speech is the healthiest of the three paths and is not the focus
  here, beyond noting the model-size inconsistency.

### 2.4 Cross-cutting defects

1. Language inconsistency: recognition is ASL, synthesis is BSL. A round trip
   is not in one language.
2. No canonical vocabulary. Three lists (recognizer classes, lexicon glosses,
   sign assets) with no shared identifier, so coverage cannot be reasoned about
   or enforced.
3. No coverage metric or regression set. Nothing fails when a common word
   silently degrades to fingerspelling.
4. Domain mismatch with the product promise. Onboarding advertises ordering
   coffee, visiting the doctor, chatting with friends; the recognizer vocabulary
   is nursery words.

## 3. Target Vocabulary

Define an everyday conversational core as the single source of truth, sized in
tiers so progress is measurable.

- Tier 1, about 250 to 400 entries: survival and daily life. Greetings,
  politeness, yes/no/maybe, question words, pronouns, numbers 0 to 20 and tens,
  time and days and months, family, food and drink, money, transport, places
  (home, work, school, hospital, shop, restaurant), health and feelings,
  high-frequency verbs (go, come, want, need, have, help, eat, drink, work,
  buy, pay, meet, understand, know, like).
- Tier 2, to about 1000 entries: broaden topics (weather, clothing, technology,
  directions, appointments, small talk).
- Tier 3, 2000 plus: open conversational coverage approaching WLASL-2000 scale.

The target list is the contract. Both the recognizer and the sign assets are
measured against it, and the lexicon maps English onto it.

## 4. Options

The three from the initial review, expanded, plus additional structural and
production options. Each is a building block; the roadmap in section 5 sequences
them.

### Option A. Realign the lexicon to existing assets (quick correctness fix)
Remap or remove the 146 lexicon glosses that have no sign so common words stop
silently fingerspelling, and wire the 116 orphan signs to the English words that
should reach them. Low effort, no new data. Stops the worst visible breakage but
does not add coverage. Necessary regardless of later choices.

### Option B. Expand the sign-asset set to the target vocabulary
Three delivery sub-options for the avatar:
- B1. Author SiGML/HamNoSys for each missing sign by hand (JASigning toolchain).
  Highest fidelity and fully synthetic, but slow and needs a sign-linguistics
  author. Realistic at tens of signs per week.
- B2. Pre-recorded video dictionary. Replace or supplement the synthetic avatar
  with curated human video clips per sign. Fast breadth, natural quality,
  introduces licensing and storage and consistency-of-signer concerns.
- B3. Pose-driven 3D avatar. Drive a rigged avatar from pose sequences
  (dictionary or motion captured), retargeted to landmarks. Consistent look with
  human-like motion, higher engineering cost.

### Option C. Replace or retrain the recognition model for adult everyday vocab
Move off the toddler GISLR set to an everyday vocabulary. Candidate corpora:
WLASL (2000 words), ASL Citizen (Microsoft, about 2700 signs, explicit license),
MS-ASL, Sem-Lex. Fine-tune or train an isolated-sign classifier on the target
vocabulary. The single highest-impact change for the sign-to-text direction.

### Option D. Commit to one sign language end to end
Pick ASL or BSL for the whole product and align both paths. Recommendation: ASL,
because the recognizer is already ASL and the larger labelled corpora and US
market favour it. This makes BSL assets technical debt to migrate, not extend.

### Option E. Canonical vocabulary registry (single source of truth)
A versioned registry keyed by a stable sign id, each entry holding: gloss,
recognizer class index (or none), sign asset reference (SiGML or video or none),
English synonyms, tier, and status. The lexicon, the recognizer label map, and
the asset folder all derive from or validate against it. Makes coverage a query
and a CI assertion rather than a guess.

### Option F. Continuous and sentence-level recognition
Everyday signing is continuous, not isolated words. Add a continuous SLR path
(segmentation plus sequence model, or a gloss-sequence model trained on How2Sign
or BOBSL-style data). Larger research effort; the realistic path is to ship
isolated recognition well first, then layer continuous on top.

### Option G. Data collection and annotation pipeline
For gaps no public corpus fills, stand up an in-house capture and annotation
flow: a recording app (reuse the existing MediaPipe capture), an annotation and
review step, signer consent and licensing, and export into the registry. Needed
for long-tail and product-specific terms.

### Option H. Production hardening
Dataset versioning (for example DVC or a Hugging Face dataset repo), a held-out
evaluation set with accuracy and coverage metrics, a CI gate that fails when
target-vocabulary coverage or recognition accuracy regresses, a licensing and
provenance audit for every external asset, and runtime monitoring of
out-of-vocabulary and fingerspell-fallback rates.

## 5. Phased Roadmap

### Phase 0. Baseline and contract (foundation)
- Author the Tier 1 target vocabulary (section 3).
- Build the canonical registry (Option E) and import the three current lists
  into it, recording each one's coverage against the target.
- Build the evaluation harness (Option H): coverage report plus a small held-out
  recognition test set. This produces the baseline numbers every later phase is
  measured against.
- Decide the language: ASL end to end (Option D).
Exit criteria: a single registry exists, current coverage of Tier 1 is measured
and published, language decision recorded.

### Phase 1. Quick wins (correctness, no new data)
- Realign the lexicon to existing assets (Option A) driven by the registry.
- Make fingerspelling an explicit, visible fallback (label it in the UI) rather
  than a silent default, and log the fallback rate.
- Enable and evaluate the `flan-t5-small` gloss corrector, or remove it.
- Resolve the Whisper base versus large model inconsistency.
Exit criteria: fingerspell-fallback rate on a sample conversation set drops from
the current 81 percent to the share genuinely lacking assets, and that share is
reported honestly.

### Phase 2. Synthesis coverage to Tier 1 (text to sign)
- Choose the avatar delivery path (Option B). Recommendation: B2 video
  dictionary for breadth first, then B1 synthetic SiGML for polish on the
  highest-frequency signs, unified behind the registry asset reference.
- Produce or license signs for the Tier 1 target, ASL.
- Gate in CI on Tier 1 synthesis coverage (Option H).
Exit criteria: every Tier 1 entry has an ASL sign asset; no Tier 1 word
fingerspells.

### Phase 3. Recognition to everyday vocab (sign to text)
- Acquire and license an adult corpus (Option C): ASL Citizen or WLASL.
- Train or fine-tune an isolated-sign classifier on the Tier 1, then Tier 2,
  target vocabulary; replace the GISLR model behind `/sign-to-text`.
- Evaluate against the held-out set; gate accuracy in CI.
Exit criteria: recognition covers Tier 1 at a target top-1 accuracy on the
held-out set, replacing the toddler vocabulary.

### Phase 4. Scale and naturalness
- Continuous and sentence-level recognition (Option F).
- Expand to Tier 2 and Tier 3 on both paths.
- Stand up the in-house capture pipeline (Option G) for long-tail and
  product-specific terms.
- Full production hardening (Option H): versioning, monitoring, periodic
  licensing re-audit.

## 6. Recommendation Summary

1. The headline issue is not size, it is three mismatched vocabularies and a
   broken lexicon-to-asset mapping. Fix the structure first (Phase 0 registry
   plus Phase 1 realignment) before buying or building any new data.
2. Commit to ASL end to end. The recognizer is already ASL and the corpora are
   stronger; treat the BSL assets as debt.
3. Sequence value by impact: correctness quick wins, then synthesis coverage to
   a defined everyday core, then a real recognition model, then continuous and
   scale.
4. Make coverage and accuracy CI-enforced metrics against a fixed target
   vocabulary, so the dataset cannot silently regress again.

## 7. External Corpora and Tooling (provenance and licensing must be checked)

- Recognition corpora: ASL Citizen (Microsoft, licensed), WLASL (2000 words,
  research-oriented, YouTube-sourced, commercial use needs review), MS-ASL,
  Sem-Lex, ASLLVD. Continuous: How2Sign (ASL), BOBSL (BSL).
- Sign reference and synthesis: ASL-LEX (sign properties), JASigning and
  HamNoSys and SiGML for synthetic signing, SignWriting and SignBank.
- Every external asset requires a license and provenance check before
  production use. Research-only datasets cannot ship in a commercial product
  without clearing terms.

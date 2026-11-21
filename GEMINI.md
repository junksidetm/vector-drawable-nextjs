# Project Instructions (GEMINI.md)

This file contains foundational mandates for Gemini CLI when working in this workspace. These instructions take precedence over general defaults.

## Tech Stack & Architecture
- **Primary Platforms:** Android development is the core focus.
- **Frameworks:** 
  - **Flutter:** For cross-platform mobile development.
  - **Jetpack Compose:** For native Android UI development.
- **Design System:** Rigorously follow **Material 3 Expressive** design language. Ensure components, typography, and motion align with the latest Material 3 guidelines.
- **Native Mandate:** The Jetpack Compose version must be as **native** as possible. 
  - Prioritize native Android primitives over cross-platform abstractions.
  - Use `Canvas` for custom visualizations.
  - Use `StateFlow` and `CollectAsStateWithLifecycle` for state management.
  - Leverage Room for offline-first data persistence.
  - Ensure high performance (60-120 FPS) by following native profiling and optimization standards.

## Resource & Performance Mandates
- **No Local Builds:** NEVER run `./gradlew assembleDebug`, `flutter build apk`, or any command that performs a full APK/binary build locally. The host machine is limited to **4 GB RAM**.
- **Remote Verification:** Use GitHub Actions (CI/CD) for all build verifications and APK generation.
- **Optimization Priority:** Proactively suggest and apply optimizations to ensure a smooth development experience:
  - Enable Gradle caching and configuration on demand.
  - Optimize `gradle.properties` for low-memory environments (e.g., limiting daemon memory).
  - Use specific linting and static analysis tools instead of full builds to find errors.
  - Suggest modularization to reduce the scope of analysis.

## Research & Knowledge
- **Search First:** Always utilize **Google Search (Internet)** to find the latest documentation, best practices, and troubleshooting information. Do not rely solely on internal knowledge for rapidly evolving frameworks like Flutter and Jetpack Compose.
- **Design Source of Truth:** Use **https://m3.material.io/** as the absolute authority for all design choices. Rigorously analyze its guidelines for color, typography, motion, and components to ensure a premium Material 3 Expressive experience.

## Coding & Editing Standards
- **Surgical Precision:** Adhere to the **Surgical Precise** method for all code modifications.
  - **Minimal Edits:** Modify only the specific lines that require changes.
  - **No Block Deletions:** Never delete an entire block or function to change a single line within it.
  - **Preserve Context:** Maintain surrounding formatting, comments, and structure exactly as they are.
- **Idiomatic Quality:** Ensure all changes are idiomatic to the respective framework (Dart/Flutter or Kotlin/Compose).
- **Validation:** Always verify changes with appropriate tests or build checks after implementation.

## context-mode — MANDATORY routing rules
context-mode MCP tools available. Rules protect context window from flooding.

### Think in Code — MANDATORY
Analyze/count/filter/compare/search/parse/transform data: **write code** via `mcp__context-mode__ctx_execute(language, code)`, `console.log()` only the answer. Do NOT read raw data into context. PROGRAM the analysis, not COMPUTE it. One script replaces ten tool calls.

### Tool Selection
1. **GATHER**: `mcp__context-mode__ctx_batch_execute(commands, queries)` — ONE call replaces 30+.
2. **FOLLOW-UP**: `mcp__context-mode__ctx_search(queries: ["q1", "q2", ...])` — batch all questions.
3. **PROCESSING**: `mcp__context-mode__ctx_execute(language, code)` | `mcp__context-mode__ctx_execute_file(path, language, code)` — sandbox, only stdout enters context.
4. **WEB**: `mcp__context-mode__ctx_fetch_and_index(url, source)` then `mcp__context-mode__ctx_search(queries)`.
5. **INDEX**: `mcp__context-mode__ctx_index(content, source)` — store in FTS5 for later search.

### Parallel I/O batches
Include `concurrency: N` (4-8) for network/API calls. Keep at 1 for CPU-bound or stateful work.

## Project Tracking & Documentation
- **Version.md Mandate:** Every project must contain a `Version.md` file. This file is the absolute source of truth for the project's evolution.
  - **Exhaustive Logging:** Track every changelog entry, library, method, and file version.
  - **CRITICAL: Strict Append Pattern:** 
    - **NEVER** use the `replace` tool or any method to edit, delete, or "update" existing lines in `Version.md`.
    - **ONLY** use `write_file` (with the full content) or append methods to add new entries at the bottom.
    - **NO STATUS UPDATES:** Do not update the "Status" line of a previous entry. If a status changes (e.g., from 90% to 100%), append a NEW entry with the new status.
    - **Immutable History:** Once information is written, it is permanent. The only exception is updating a library's version number within the "Libraries & Tools" section.
  - **Real-time Updates:** Log changes immediately after completion.
  - **Metadata:** Every entry must be logged with the current date and time.
- **Mandatory Pre-Work Protocol (Always Read First):**
  - **Sequential Prerequisite:** You will ALWAYS read `Version.md` (or `version.md`) and `GEMINI.md` (or `gemini.md`) of that repository before starting any work on that repo.
  - **Zero Exceptions:** ONLY after thoroughly reading both `Version.md` and `GEMINI.md` are you permitted to analyze, plan, execute commands, or modify files within that repository.

## Project Commands
- **NEVER** run "/gradlew assembleDebug"

## Repository Fork Lineage & Upstream Sources
- **Gboard Patches (`D:\code\Gboard-patches`):** Forked from [jasonwu1994/Gboard-patches](https://github.com/jasonwu1994/Gboard-patches).
- **Vector Drawable (`D:\code\vector-drawable-nextjs`):** Forked from [seanghay/vector-drawable-nextjs](https://github.com/seanghay/vector-drawable-nextjs).
- **Rivo Phone App (`D:\code\RivoPhoneApp`):** Forked from [user-grinch/RivoPhoneApp](https://github.com/user-grinch/RivoPhoneApp).
- **Cresto (`D:\code\Cresto`):** Forked from [Nevodev/Cresto](https://github.com/Nevodev/Cresto).
- **Physics Wonderland (`D:\code\physics-wonderland`):** Forked from [saltymother/physics-wonderland](https://github.com/saltymother/physics-wonderland).
- **Expressive Clock (`D:\code\expressive-clock`):** Forked from [samuelbeckman/expressive-clock](https://github.com/samuelbeckman/expressive-clock) (originally from [rbouaf/material-clock](https://github.com/rbouaf/material-clock)).

## Multi-Platform Ecosystem & Mirror Mandates (GitHub, GitLab, Codeberg)
- **Primary vs. Mirrors:** GitHub (`junksidetm`) is the **Main** repository; Codeberg (`mrdarksidetm`) and GitLab (`mrdarksidetm`) are official **Mirrors**.
- **Active Functional Parity Across All Platforms:**
  - Mirrors are **not** passive, dormant code dumps. Repositories on all three platforms (GitHub, GitLab, Codeberg) must actively produce the complete deliverables configured for the project:
  - **Identical Production Signed APKs:** APKs must be built and production-signed across all platforms (e.g., via GitHub Actions, GitLab CI/CD, and Forgejo Actions), producing identical, release-signed production APKs using the same signing keystore and release configurations.
  - **Webpages & Documentation (Pages):** Documentation and web applications must be actively deployed across all platforms depending on the repository (`github.io`, `gitlab.io`, `codeberg.page`).
  - **Releases & Binary Assets:** Production releases, tags, changelogs, and attached binary assets must be published and synchronized across GitHub, GitLab, and Codeberg.
- **Commit Verification & Cryptographic Signing:**
  - **Verified Commit Mandate:** Every single commit must be cryptographically signed with an SSH key and show as **Verified** across all platforms.
  - **Platform Identity Rules:**
    - **GitHub:** Identity must be `junksidetm` (`331540275+junksidetm@users.noreply.github.com`), signed with `id_ed25519_junksidetm`.
    - **GitLab & Codeberg:** Identity must be `mrdarksidetm` (`ajukr99901@gmail.com`), signed with `id_ed25519_signing`.
    - **Cross-Host Verification Architecture:** For repositories utilizing concurrent multi-push synchronization, the signing keys and author emails must be registered across the accounts (or handled via platform-specific commit signing) to ensure that every mirror displays a verified cryptographic status.

## Release Tagging & Title Naming Mandates (ALL Repositories)
- **Tag Format:** Must strictly follow semantic versioning prefixed with a lowercase `v` (e.g., `v3.4.0`, `v3.5.0`).
- **Release Title Format:** The Release Title MUST EXACTLY match the tag name itself (e.g., `v3.4.0`).
  - **NEVER** prefix or suffix the release title with the application name (e.g., NEVER use `Battery Mode Checker v3.4.0` or `Autostart Manager v3.4.0`).
  - The release title must simply and solely be the tag string: `v<Version>` (e.g., `v3.4.0`).
- **CI/CD Workflow Alignment:** All GitHub Actions, GitLab CI/CD, and Forgejo/Codeberg release generation workflows must configure the release name/title parameter to match the tag directly (e.g., `name: "v${{ steps.version.outputs.version }}"` or `name: "${{ github.ref_name }}"`).


## Upstream Modding & Stability Gating Mandates (Anti-Fragile Architecture)
- **"If It Works, Don't Fix It" Principle:** When an existing baseline release (e.g., `v452.0.0.0.7`) is verified and functional, never compromise production stability to accommodate an untested or broken upstream release.
- **Production Baseline Pinning:**
  - Automated CI/CD release workflows must strictly pin production builds to verified stable versions.
  - New upstream Alpha/nightly releases are treated as untrusted staging candidates until verified on physical devices.
  - Never promote an upstream Alpha to the main release channel if it fails cold-start activity launch (`InflateException`, `VerifyError`, lifecycle crashes).
- **No Reinventing the Wheel:**
  - Do NOT write complex file-system regex mutators, synthetic layout injectors, or global smali exception-swallowers to work around upstream schema breaks.
  - Mod scope is strictly limited to application enhancements (typography, emojis, styling, dev tools, and clone variants). Mod engines must not attempt to re-engineer third-party layout compilers or Android framework internals.
- **Surgical Root-Cause Discipline:**
  - If an upstream Alpha must be patched, address the root cause at the most idiomatic, minimal layer:
    1. **Resource / Theme Fallbacks:** Supply missing theme attribute dimensions (`styles.xml` / `themes.xml`) rather than editing binary/Superpack layout XML on disk.
    2. **Runtime Framework Hooks:** Intercept dynamically via official framework mechanisms (e.g., `LayoutInflater.Factory2` in application lifecycle callbacks) rather than brute-force decompiled file mutation.

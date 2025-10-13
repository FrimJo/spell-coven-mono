# Feature Specification: MTG Image DB Quality Improvements

**Feature Branch**: `003-improve-mtg-image`  
**Created**: 2025-10-13  
**Status**: Draft  
**Input**: User description: "Improve mtg-image-db code quality, observability, testing, and developer experience by implementing all remaining improvements from IMPROVEMENTS.md"

**Source**: Migrated from `packages/mtg-image-db/IMPROVEMENTS.md` (Priority 3-9 improvements)

## Background

This feature implements all remaining improvements from the mtg-image-db technical backlog. Previous improvements (P1.x and P2.x) focused on user-facing features and have been completed:

**Completed Improvements** (documented in `specs/001-enable-mtg-players/`):
- ✅ P1.1: Fix Cosine Similarity Calculation
- ✅ P1.2: Make Query Path a CLI Argument  
- ✅ P1.3: Add CLI Arguments to export_for_browser.py
- ✅ P2.1: Use Higher Quality Images (PNG priority)
- ✅ P2.2: Increase Image Resolution (384px)
- ✅ P2.3: Implement HNSW Index
- ✅ P2.4: Quantize Embeddings to int8

**User Priorities** (from original backlog):
1. Accuracy from blurry/bad images (addressed by P2.1, P2.2)
2. Query speed for users (addressed by P2.3)
3. Browser DB size (addressed by P2.4)
4. Build time is NOT a priority

This feature focuses on **developer experience** and **production readiness** rather than end-user features.

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Debugging Build Failures (Priority: P1)

As a developer running the mtg-image-db build process, I want comprehensive logging and error reporting so I can quickly identify and fix issues when downloads fail, images are corrupt, or the build encounters problems.

**Why this priority**: Production readiness. Without proper observability, developers waste hours debugging silent failures. This is the foundation for reliable operation.

**Independent Test**: Run build with intentionally broken network/corrupt images and verify that all failures are logged with clear error messages and a summary is displayed at the end.

**Acceptance Scenarios**:

1. **Given** a build is running and an image download fails, **When** the build completes, **Then** I see a log entry with the URL, error message, and retry count
2. **Given** a build completes, **When** I review the output, **Then** I see a summary showing total cards, successful downloads, failed downloads, and success percentage
3. **Given** a corrupt image is downloaded, **When** validation runs, **Then** the corrupt file is detected, deleted, and logged as a failure
4. **Given** the output directory is not writable, **When** I run export, **Then** I see a clear error message before any processing starts

**Improvements**: P3.1 (Logging), P3.2 (Summaries), P3.3 (Validation)

---

### User Story 2 - Confident Code Changes (Priority: P2)

As a developer making changes to mtg-image-db, I want comprehensive automated tests so I can verify my changes don't break existing functionality and catch bugs before they reach production.

**Why this priority**: Essential for maintainability. Without tests, every change risks breaking the pipeline. Tests enable confident refactoring and catch regressions early.

**Independent Test**: Run test suite after making a code change and verify all tests pass, providing confidence that core functionality still works.

**Acceptance Scenarios**:

1. **Given** I modify a core function, **When** I run unit tests, **Then** tests verify the function still behaves correctly
2. **Given** I want to verify end-to-end functionality, **When** I run the integration test, **Then** it completes the full pipeline (download → embed → export → query) with a small dataset
3. **Given** I've built a new index, **When** I run the validation script, **Then** it checks embedding normalization, count consistency, and FAISS integrity
4. **Given** I run the test suite, **When** tests complete, **Then** I see >80% code coverage for core functions

**Improvements**: P5.1 (Unit Tests), P5.2 (Integration Tests), P5.3 (Validation Script)

---

### User Story 3 - Easier Configuration and Maintenance (Priority: P3)

As a developer working with mtg-image-db, I want clean, well-typed code with flexible configuration so the codebase is easy to understand, modify, and configure for different use cases.

**Why this priority**: Reduces technical debt and improves long-term maintainability. Makes onboarding new developers faster and reduces bugs from type errors.

**Independent Test**: Configure build via YAML file, make code changes with IDE autocomplete from type hints, and verify shared utilities are used consistently.

**Acceptance Scenarios**:

1. **Given** I want to configure a build, **When** I create a config.yml file, **Then** all parameters can be specified without CLI arguments
2. **Given** I'm writing code in an IDE, **When** I use a function, **Then** I get accurate autocomplete and type checking from comprehensive type hints
3. **Given** I need device selection logic, **When** I import the utility, **Then** all scripts use the same shared function
4. **Given** I want different image quality, **When** I configure image preference, **Then** the build uses my custom priority order
5. **Given** I run mypy in strict mode, **When** type checking completes, **Then** all files pass without errors

**Improvements**: P4.1 (Shared Utilities), P4.2 (Type Hints), P4.3 (Configurable Preferences), P6.1 (YAML Config)

---

### User Story 4 - Resumable and Reproducible Builds (Priority: P4)

As a developer running long builds, I want to resume interrupted builds and ensure reproducible results across different machines and time periods.

**Why this priority**: Improves developer experience and team collaboration. Long builds shouldn't restart from scratch after interruptions, and team members should get identical results.

**Independent Test**: Interrupt a build mid-way, resume it, and verify it continues from where it left off. Build on two different machines and verify identical output.

**Acceptance Scenarios**:

1. **Given** a build is interrupted, **When** I restart it, **Then** it resumes from the last checkpoint without re-processing completed items
2. **Given** I'm on a team, **When** I use the same conda lock file as my teammate, **Then** I get an identical environment
3. **Given** I return to the project after months, **When** I use pinned dependencies, **Then** I can recreate the exact environment that was used previously

**Improvements**: P6.2 (Resume Support), P8.1 (Pin CLIP), P8.2 (Conda Locks)

---

### User Story 5 - Better Documentation and Onboarding (Priority: P5)

As a new developer or user of mtg-image-db, I want comprehensive documentation with troubleshooting guides and performance benchmarks so I can get started quickly and set realistic expectations.

**Why this priority**: Reduces support burden and enables self-service. New contributors can onboard faster and users can solve common problems independently.

**Independent Test**: Give documentation to a new developer and verify they can set up, run a build, and troubleshoot common issues without asking for help.

**Acceptance Scenarios**:

1. **Given** I encounter a common issue, **When** I check the troubleshooting section, **Then** I find the solution without asking for help
2. **Given** I'm planning a build, **When** I check performance benchmarks, **Then** I know expected runtime, memory, and disk requirements for my hardware
3. **Given** I'm new to the project, **When** I read the README, **Then** I understand how to set up, configure, and run the pipeline

**Improvements**: P7.1 (Troubleshooting), P7.2 (Benchmarks)

---

### User Story 6 - Advanced Developer Workflows (Priority: P6)

As an advanced developer, I want Docker support, pre-commit hooks, quality metrics, and incremental updates so I can use modern development workflows and optimize the pipeline for my specific needs.

**Why this priority**: Nice-to-have features for power users. Not essential for basic operation but significantly improve advanced workflows.

**Independent Test**: Run build in Docker, commit code with pre-commit hooks active, analyze embedding quality, and incrementally add new cards to existing index.

**Acceptance Scenarios**:

1. **Given** I don't have Conda, **When** I use Docker, **Then** I can run the full pipeline in a containerized environment
2. **Given** I commit code, **When** pre-commit hooks run, **Then** formatting, linting, and type checks pass automatically
3. **Given** I want to analyze data quality, **When** I run quality metrics, **Then** I get distribution plots and outlier reports
4. **Given** new cards are released, **When** I run incremental update, **Then** only new cards are processed and added to the existing index

**Improvements**: P9.1 (Docker), P9.2 (Pre-commit), P9.3 (Quality Metrics), P9.4 (Incremental Updates)

### Edge Cases

- **What happens when Scryfall API is down?** Build logs clear error, suggests retry with exponential backoff, and allows resuming later
- **What happens when disk space runs out during build?** Build detects disk space issues early and fails with clear error before corrupting data
- **What happens when CLIP model download fails?** Clear error message with troubleshooting steps (check internet, try different mirror)
- **What happens when config.yml has invalid values?** Validation catches errors on load with specific field names and expected formats
- **What happens when resuming a build with different parameters?** Build detects parameter mismatch and warns user before proceeding
- **What happens when running tests without test data?** Tests either skip gracefully or download minimal test dataset automatically
- **What happens when conda lock file is outdated?** Clear warning about version mismatch with instructions to regenerate
- **What happens when incremental update finds duplicate cards?** Duplicates are detected and skipped with log entry
- **What happens when Docker container runs out of memory?** Container fails with clear OOM error and suggested memory increase

## Requirements *(mandatory)*

### Functional Requirements

**Observability & Error Handling (P3.x)**:
- **FR-001**: System MUST log all failed image downloads with URL, error message, and retry count
- **FR-002**: System MUST display a build summary showing total records, successful/failed downloads, and success percentage
- **FR-003**: System MUST validate downloaded images and delete corrupt files
- **FR-004**: System MUST validate output directory writability before starting export

**Testing & Validation (P5.x)**:
- **FR-005**: System MUST provide unit tests for core functions with >80% coverage
- **FR-006**: System MUST provide integration test that runs full pipeline with small dataset
- **FR-007**: System MUST provide validation script that checks embedding normalization, count consistency, and FAISS integrity

**Code Quality (P4.x)**:
- **FR-008**: System MUST extract device selection logic to shared utility function
- **FR-009**: System MUST have comprehensive type hints on all functions and classes
- **FR-010**: System MUST allow configurable image quality preference via CLI or config file

**Configuration (P6.x)**:
- **FR-011**: System MUST support YAML configuration file for all build parameters
- **FR-012**: System MUST support resuming interrupted builds from checkpoints
- **FR-013**: System MUST validate configuration files and provide clear error messages

**Documentation (P7.x)**:
- **FR-014**: System MUST provide troubleshooting section covering common issues
- **FR-015**: System MUST provide performance benchmarks for different hardware configurations

**Dependency Management (P8.x)**:
- **FR-016**: System MUST pin CLIP dependency to specific commit hash
- **FR-017**: System MUST provide conda lock files for reproducible environments

**Advanced Features (P9.x)**:
- **FR-018**: System MUST support Docker-based builds
- **FR-019**: System MUST provide pre-commit hooks for code quality
- **FR-020**: System MUST provide embedding quality analysis tools
- **FR-021**: System MUST support incremental updates to existing index

### Key Entities

- **Build Configuration**: Represents all parameters for a build including data source, paths, embedding settings, download settings, and index settings. Can be specified via CLI args or YAML file.
- **Build Summary**: Represents the outcome of a build including total records processed, success/failure counts, timing information, and data quality metrics.
- **Test Suite**: Collection of unit tests, integration tests, and validation scripts that verify system correctness and data integrity.
- **Quality Metrics**: Analysis of embedding distribution, nearest neighbor patterns, outliers, and other data quality indicators.

## Success Criteria *(mandatory)*

### Measurable Outcomes

**Observability**:
- **SC-001**: 100% of download failures are logged with actionable error messages
- **SC-002**: Build summary displays within 1 second of build completion
- **SC-003**: Corrupt images are detected and removed before causing embedding failures

**Testing**:
- **SC-004**: Unit test suite achieves >80% code coverage for core functions
- **SC-005**: Integration test completes full pipeline in <5 minutes with 100-card dataset
- **SC-006**: Validation script catches 100% of data integrity issues (count mismatches, denormalized vectors, corrupt indices)

**Code Quality**:
- **SC-007**: mypy strict mode passes with 0 errors across all Python files
- **SC-008**: Device selection logic exists in exactly 1 place, used by all scripts
- **SC-009**: Image preference can be customized without modifying code

**Configuration**:
- **SC-010**: All CLI parameters can be specified via YAML config file
- **SC-011**: Interrupted builds can resume without re-processing >90% of completed work
- **SC-012**: Config validation catches 100% of invalid parameter combinations before build starts

**Documentation**:
- **SC-013**: Troubleshooting section covers 10+ common issues with solutions
- **SC-014**: Performance benchmarks document runtime for CPU/GPU/MPS with 3+ dataset sizes
- **SC-015**: New developers can complete first successful build within 30 minutes using only README

**Reproducibility**:
- **SC-016**: Conda lock files produce bit-for-bit identical environments across machines
- **SC-017**: Builds with same parameters produce identical embeddings (verified by hash)

**Advanced Features**:
- **SC-018**: Docker build completes successfully on systems without Conda
- **SC-019**: Pre-commit hooks catch 100% of formatting/linting issues before commit
- **SC-020**: Quality metrics identify outliers and distribution anomalies
- **SC-021**: Incremental update adds new cards in <10% of full rebuild time

# Project Operating Rules & Guardrails

## File Deletion & Refactoring Rules (Standing Directive)
1. **Pre-Deletion Trace**: Before deleting or renaming ANY file, scan the entire codebase (`src/`, `server/`, etc.) for all static imports, dynamic `import()`, re-exports, and string path references.
2. **Zero Dangling References**: Never delete any module that is still referenced or imported anywhere in the project. Decouple and update all consuming components first.
3. **Mandatory Post-Action Verification**: After any deletion, renaming, or refactoring, always run `compile_applet` and `lint_applet` to verify that the build succeeds with zero errors.

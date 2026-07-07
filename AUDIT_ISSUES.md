# Audit Issues and Observations

Summary
-------
- Action: Ran the full test suite via `npm test` (Vitest).
- Result: All tests passed.
  - Test files: 37 passed
  - Tests: 301 passed
  - Duration: ~52s

Observed Warning
----------------
- While running tests a Node deprecation warning was emitted:

  (node:7872) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.

- This is a runtime deprecation (warning only) and did not cause test failures, but it is worth investigating.

Potential Causes
----------------
- A dependency (likely a devDependency used by the test environment) calls the deprecated API. Candidates include test tooling, environment shims, or older helper libraries.

Reproduction
------------
Run the same command locally from the project root:

```powershell
cd ENERMASS-CALCULATOR
npm test
```

For more detail (trace the origin of the deprecation):

```powershell
cd ENERMASS-CALCULATOR
node --trace-deprecation node_modules/vitest/vitest.mjs run
```

Next Steps / Recommendations
----------------------------
- Search for uses of `module.register(` in the repository and in devDependencies.
  - Use `rg "module\.register\(" -S` or PowerShell `Select-String` if `rg` is unavailable.
- Upgrade test-related dependencies (`vitest`, `jsdom`, `playwright`, etc.) to latest compatible versions.
- If the trace identifies a specific dependency, open an issue with that project or pin/upgrade a version that has migrated to `module.registerHooks()`.

If you want me to intentionally introduce a failing case (e.g., create a failing test or modify a file to cause an error) so you can see the error reporting artifact, tell me which type of failure you'd like (unit test failure, runtime error, build failure) and I'll create a minimal reproducible change and add a dedicated report file.

# What's New

## 0.4.1
- Bug fixes.

## 0.4.0
- The minumum VSCode version is now 1.9.
- Added debugger API for HTML display.
- @keyword is no longer allowed in "simple" expressions, the '/py ...' syntax replaces that.
- Changed prefix for invoking native evaluator: `?<expr>` -> `/nat <expr>`
- Changed prefix for regex breakpoints: `/` -> `/re `.
- Fixed bugs #18, #19.

## 0.3.4
- Bug fixes.

## 0.3.3
- [Custom launch requests](MANUAL.md#custom-launch).
- Command completions in debug console.
- Windows LLDB is now supported!
- Debugger stdout is now piped to debug console.
- Fixed bug #13 (breakpoints in headers).

## 0.3.2
- Added pickProcess and pickMyProcess commands to be used with the **pid** parameter when [attaching](README.md#attaching).
- Added debug configuration snippets.
- Added Swift debugging (thanks @jesspittman!).

## 0.3.1
- Bug fixes.

## 0.3.0
- [Variable visualizers for Rust](MANUAL.md#rust-language-support).
- New [expression evaluator](MANUAL.md#expressions).
- Bug fixes.

## 0.2.2
- Bug fixes.

## 0.2.1
- Added 'terminal' launch config option. '*' in stdio config now behaves identically to null.
- Moved static variables out to their own scope.
- Disassembly in symbolless locations should work now.
- Resume debuggee after attach, unless stopOnEntry is true.

## 0.2.0
- Added [disassembly view](MANUAL.md#disassembly-view).
- Added [variable formatting](MANUAL.md#formatting).

## 0.1.3
- Added support for setting variable values (primitive types only).
- Added [regex breakpoints](MANUAL.md#regex-breakpoints).

## 0.1.2
- Infer `.exe` target extension on Windows.
- `args` may now be a string.

## 0.1.0
First released version.

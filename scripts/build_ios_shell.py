"""Build the C/Objective-C-runtime iOS shell with LLVM, without an Apple SDK.

The generated .tbd files only describe public system symbols. Implementations
come from the installed iPhone's UIKit/Foundation/WebKit/libobjc/libSystem.
Output is an arm64, ad-hoc signed executable for ordinary sideload re-signing.
"""
from pathlib import Path
import argparse
import hashlib
import json
import os
import subprocess

ROOT = Path(__file__).resolve().parents[1]
LIBRARIES = {
    'System/Library/Frameworks/UIKit.framework/UIKit': ['_UIApplicationMain'],
    'System/Library/Frameworks/Foundation.framework/Foundation': ['_NSTemporaryDirectory'],
    'System/Library/Frameworks/WebKit.framework/WebKit': [],
    'usr/lib/libobjc.A': ['_objc_getClass', '_objc_allocateClassPair',
        '_objc_registerClassPair', '_sel_registerName', '_class_addMethod',
        '_objc_getProtocol', '_class_addProtocol', '_objc_msgSend',
        '_objc_autoreleasePoolPush', '_objc_autoreleasePoolPop'],
    'usr/lib/libSystem.B': ['dyld_stub_binder', '___stack_chk_guard', '___stack_chk_fail'],
}


def build(output, clang, linker, runtime_lib=None):
    output.mkdir(parents=True, exist_ok=True)
    environment = os.environ.copy()
    if runtime_lib:
        environment['LD_LIBRARY_PATH'] = str(runtime_lib) + ':' + environment.get('LD_LIBRARY_PATH', '')
    stubs = output / 'system-symbols'
    for name, symbols in LIBRARIES.items():
        path = stubs / (name + '.tbd')
        path.parent.mkdir(parents=True, exist_ok=True)
        install_name = '/' + name + ('.dylib' if name.startswith('usr/') else '')
        text = '--- !tapi-tbd\ntbd-version: 4\ntargets: [ arm64-ios ]\n'
        text += 'install-name: ' + json.dumps(install_name) + '\n'
        text += 'exports:\n  - targets: [ arm64-ios ]\n    symbols: ' + json.dumps(symbols) + '\n...\n'
        path.write_text(text)
    obj, executable = output / 'List.o', output / 'List'
    subprocess.run([str(clang), '-target', 'arm64-apple-ios16.0', '-std=c11',
        '-O2', '-Wall', '-Wextra', '-Werror', '-fno-builtin',
        '-fstack-protector-strong', '-c', str(ROOT / 'native/ios/List.c'),
        '-o', str(obj)], env=environment, check=True)
    command = [str(linker), '-arch', 'arm64', '-platform_version', 'ios', '16.0', '18.0',
        '-syslibroot', str(stubs), '-F', str(stubs / 'System/Library/Frameworks'),
        '-L', str(stubs / 'usr/lib'), '-framework', 'UIKit', '-framework', 'Foundation',
        '-framework', 'WebKit', '-lobjc.A', '-lSystem.B', '-e', '_main',
        '-no_fixup_chains', '-adhoc_codesign', '-o', str(executable), str(obj)]
    subprocess.run(command, env=environment, check=True)
    report = {'target': 'arm64-apple-ios16.0', 'sdk_metadata': '18.0',
        'signing': 'ad-hoc executable; normal sideload re-signing required',
        'uses_apple_sdk': False, 'device_tested': False,
        'executable_bytes': executable.stat().st_size,
        'sha256': hashlib.sha256(executable.read_bytes()).hexdigest(),
        'sources': {path.name: hashlib.sha256(path.read_bytes()).hexdigest()
                    for path in sorted((ROOT / 'native/ios').glob('*.[ch]'))}}
    (output / 'build-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--clang', type=Path, required=True)
    parser.add_argument('--linker', type=Path, required=True)
    parser.add_argument('--runtime-lib', type=Path)
    args = parser.parse_args()
    build(args.out, args.clang, args.linker, args.runtime_lib)

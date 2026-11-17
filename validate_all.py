import os
import re

def validate_js_syntax(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        text = f.read()

    # Simple tokenizer / bracket balance
    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    in_str = None
    in_regex = False
    in_line_comment = False
    in_block_comment = False
    esc = False
    line_num = 1
    col = 0
    prev_token = ''

    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        if ch == '\n':
            line_num += 1
            col = 0
            in_line_comment = False
            i += 1
            continue
        col += 1

        if in_line_comment:
            i += 1
            continue

        if in_block_comment:
            if ch == '*' and i + 1 < n and text[i+1] == '/':
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue

        if in_str:
            if esc:
                esc = False
            elif ch == '\\':
                esc = True
            elif ch == in_str:
                in_str = None
            i += 1
            continue

        # Check comment starts
        if ch == '/' and i + 1 < n and text[i+1] == '/':
            in_line_comment = True
            i += 2
            continue
        if ch == '/' and i + 1 < n and text[i+1] == '*':
            in_block_comment = True
            i += 2
            continue

        # Check regex literal
        if ch == '/' and prev_token in ('(', ',', '=', ':', '[', '!', '&', '|', '?', ';', '{', 'return', 'case'):
            # It is a regex
            i += 1
            while i < n and text[i] != '\n':
                if text[i] == '\\':
                    i += 2
                    continue
                if text[i] == '/':
                    i += 1
                    # consume flags
                    while i < n and text[i] in 'gimsuy':
                        i += 1
                    break
                i += 1
            prev_token = 'regex'
            continue

        if ch in ('"', "'", '`'):
            in_str = ch
            i += 1
            continue

        if ch in ('(', '[', '{'):
            stack.append((ch, line_num, col))
            prev_token = ch
        elif ch in (')', ']', '}'):
            if not stack:
                return False, f"Unexpected {ch} at {filename}:{line_num}:{col}"
            last, lnum, lcol = stack.pop()
            if pairs[ch] != last:
                return False, f"Mismatched {last} (line {lnum}) with {ch} (line {line_num}:{col})"
            prev_token = ch
        elif not ch.isspace():
            prev_token = ch

        i += 1

    if stack:
        last, lnum, lcol = stack[-1]
        return False, f"Unclosed token {last} opened at line {lnum}:{lcol}"

    return True, "Valid"

files = ['manifest.json', 'popup.js', 'background.js', 'content.js', 'storage.js', 'utils.js']
for fn in files:
    if fn.endswith('.js'):
        ok, msg = validate_js_syntax(fn)
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] {fn}: {msg}")
    elif fn.endswith('.json'):
        import json
        try:
            with open(fn, 'r', encoding='utf-8') as f:
                json.load(f)
            print(f"[PASS] {fn}: Valid JSON")
        except Exception as e:
            print(f"[FAIL] {fn}: {e}")

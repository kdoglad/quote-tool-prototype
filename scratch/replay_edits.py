import json
import ast

log_path = r"C:\Users\MackAndrewRosario\.gemini\antigravity-ide\brain\8637612c-281c-4181-b2ec-63114b09e787\.system_generated\logs\transcript.jsonl"
target_file_suffix = "QuoteEditorPage.tsx"

def apply_replace(content, start_line, end_line, target, replacement):
    start_line = int(start_line)
    end_line = int(end_line)
    if target in content:
        return content.replace(target, replacement, 1)
    
    lines = content.split('\n')
    start_idx = start_line - 1
    end_idx = end_line
    replacement_lines = replacement.split('\n')
    before = lines[:start_idx]
    after = lines[end_idx:]
    return '\n'.join(before + replacement_lines + after)

def parse_chunks(chunks_str):
    try:
        return json.loads(chunks_str)
    except:
        # If json fails, try replacing invalid control chars
        import re
        s = re.sub(r'[\x00-\x1f]', '', chunks_str)
        try:
            return json.loads(s)
        except:
            # Fallback to ast if string formatting is weird
            try:
                # Need to convert true/false to True/False for python eval
                s_py = chunks_str.replace('true', 'True').replace('false', 'False').replace('null', 'None')
                return ast.literal_eval(s_py)
            except Exception as e:
                print("Failed to parse chunks:", e)
                return []

def main():
    with open(r"src\pages\quotes\QuoteEditorPage.tsx", "r", encoding="utf-8") as f:
        content = f.read()
    
    with open(log_path, 'r', encoding='utf-8') as f:
        for line_str in f:
            try:
                data = json.loads(line_str)
            except:
                continue
            
            if data.get('type') == 'PLANNER_RESPONSE' and data.get('tool_calls'):
                for tc in data['tool_calls']:
                    if tc.get('name') == 'run_command':
                        cmd = tc.get('args', {}).get('CommandLine', '')
                        if 'git checkout' in cmd and target_file_suffix in cmd:
                            print("Found git checkout. Stopping replay.")
                            with open("scratch/QuoteEditorPage_reconstructed.tsx", "w", encoding="utf-8") as out_f:
                                out_f.write(content)
                            return

                    if tc.get('name') in ['replace_file_content', 'multi_replace_file_content']:
                        args = tc.get('args', {})
                        if target_file_suffix in args.get('TargetFile', ''):
                            if tc.get('name') == 'replace_file_content':
                                content = apply_replace(content, args['StartLine'], args['EndLine'], args['TargetContent'], args['ReplacementContent'])
                            elif tc.get('name') == 'multi_replace_file_content':
                                chunks = args.get('ReplacementChunks', [])
                                if isinstance(chunks, str):
                                    chunks = parse_chunks(chunks)
                                if chunks:
                                    chunks.sort(key=lambda x: int(x.get('StartLine', 0)), reverse=True)
                                    for chunk in chunks:
                                        content = apply_replace(content, chunk['StartLine'], chunk['EndLine'], chunk['TargetContent'], chunk['ReplacementContent'])

    with open("scratch/QuoteEditorPage_reconstructed.tsx", "w", encoding="utf-8") as out_f:
        out_f.write(content)

if __name__ == "__main__":
    main()

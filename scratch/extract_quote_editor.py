import json

log_path = r"C:\Users\MackAndrewRosario\.gemini\antigravity-ide\brain\8637612c-281c-4181-b2ec-63114b09e787\.system_generated\logs\transcript.jsonl"
out_path = r"C:\Users\MackAndrewRosario\Desktop\git-quote-tool\quote-tool\scratch\extracted_quote_editor.txt"

content_blocks = []
with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            if data.get('type') == 'PLANNER_RESPONSE' and data.get('tool_calls'):
                for tc in data['tool_calls']:
                    if tc.get('name') == 'multi_replace_file_content':
                        args = tc.get('args', {})
                        if 'QuoteEditorPage.tsx' in args.get('TargetFile', ''):
                            content_blocks.append(line)
            if data.get('type') == 'TOOL_RESPONSE':
                output = data.get('output', '')
                if 'QuoteEditorPage.tsx' in output:
                    content_blocks.append(line)
        except:
            pass

with open(out_path, 'w', encoding='utf-8') as f:
    f.writelines(content_blocks)

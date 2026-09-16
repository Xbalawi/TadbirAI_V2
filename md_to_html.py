import markdown
import sys
import re

def render_md_to_html(md_path, html_path):
    with open(md_path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    # We won't use the python-markdown to render mermaid blocks natively, 
    # instead we will replace ```mermaid ... ``` with <pre class="mermaid">...</pre>
    def mermaid_replacer(match):
        code = match.group(1)
        return f'<pre class="mermaid">{code}</pre>'

    text = re.sub(r'```mermaid\n(.*?)\n```', mermaid_replacer, text, flags=re.DOTALL)
    
    html_content = markdown.markdown(text, extensions=['tables', 'fenced_code'])
    
    full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SAD & SDD - Tadbir AI</title>
    <script type="module">
      import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
      mermaid.initialize({{ startOnLoad: true, theme: 'default' }});
    </script>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1000px;
            margin: 0 auto;
            padding: 40px 20px;
        }}
        h1, h2, h3, h4 {{
            color: #24292e;
            border-bottom: 1px solid #eaecef;
            padding-bottom: 0.3em;
            margin-top: 24px;
            margin-bottom: 16px;
        }}
        h3 {{ border-bottom: none; }}
        h4 {{ border-bottom: none; font-size: 1.1em; color: #555; }}
        table {{
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 20px;
            font-size: 0.95em;
        }}
        th, td {{
            border: 1px solid #dfe2e5;
            padding: 8px 13px;
            text-align: left;
        }}
        th {{
            background-color: #f6f8fa;
        }}
        code {{
            background-color: rgba(27,31,35,0.05);
            padding: 0.2em 0.4em;
            border-radius: 3px;
            font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
            font-size: 85%;
        }}
        pre {{
            background-color: #f6f8fa;
            padding: 16px;
            overflow: auto;
            border-radius: 3px;
        }}
        pre.mermaid {{
            background-color: transparent;
            border: none;
            text-align: center;
        }}
        .page-break {{
            page-break-after: always;
        }}
        @media print {{
            body {{ padding: 0; max-width: 100%; }}
            pre.mermaid {{ page-break-inside: avoid; }}
        }}
    </style>
</head>
<body>
    {html_content}
</body>
</html>"""

    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(full_html)
    print("Done")

if __name__ == "__main__":
    render_md_to_html("SAD_and_SDD.md", "SAD_and_SDD.html")

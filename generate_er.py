import re
import sys

def parse_models_to_mermaid(models_path):
    with open(models_path, 'r', encoding='utf-8') as f:
        content = f.read()

    modules = re.split(r'# ==========================================\n# \d+\. (.*?) \(\d+ Tables\)\n# ==========================================\n', content)
    
    # modules[0] is everything before the first module
    
    markdown_output = "### 3.3 Detailed Database Entity-Relationship Models\n\nThe following diagrams detail the exact database schema derived directly from the Django models.\n\n"
    
    for i in range(1, len(modules), 2):
        module_name = modules[i].strip()
        module_code = modules[i+1]
        
        markdown_output += f"#### {module_name}\n\n```mermaid\nerDiagram\n"
        
        # Find all classes
        classes = re.findall(r'class (\w+)\(models\.Model\):(.*?)((?=\nclass )|(?=# ==========================================)|$)', module_code, re.DOTALL)
        
        relationships = []
        for class_name, class_body, _ in classes:
            fields = []
            for line in class_body.split('\n'):
                line = line.strip()
                if not line or line.startswith('#'): continue
                if '=' not in line: continue
                
                parts = line.split('=', 1)
                field_name = parts[0].strip()
                field_def = parts[1].strip()
                
                # Check for ForeignKeys
                fk_match = re.search(r'models\.ForeignKey\((?:[\'"](.*?)[\'"]|(\w+))', field_def)
                if fk_match:
                    target = fk_match.group(1) or fk_match.group(2)
                    if target == "'self'" or target == 'self': target = class_name
                    relationships.append(f"    {target} ||--o{{ {class_name} : has")
                    
                    fields.append(f"        UUID {field_name}_id FK")
                else:
                    # Guess type
                    if 'UUIDField' in field_def: type_str = "UUID"
                    elif 'CharField' in field_def or 'TextField' in field_def or 'EmailField' in field_def: type_str = "string"
                    elif 'IntegerField' in field_def: type_str = "int"
                    elif 'DecimalField' in field_def or 'FloatField' in field_def: type_str = "float"
                    elif 'BooleanField' in field_def: type_str = "boolean"
                    elif 'DateTimeField' in field_def or 'DateField' in field_def: type_str = "datetime"
                    elif 'JSONField' in field_def: type_str = "json"
                    else: type_str = "string"
                    
                    if 'primary_key=True' in field_def:
                        fields.append(f"        {type_str} {field_name} PK")
                    else:
                        fields.append(f"        {type_str} {field_name}")
            
            # Print class and fields
            markdown_output += f"    {class_name} {{\n"
            markdown_output += "\n".join(fields)
            markdown_output += "\n    }\n"
            
        markdown_output += "\n" + "\n".join(set(relationships)) + "\n```\n\n"
        
    return markdown_output

if __name__ == "__main__":
    mermaid_markdown = parse_models_to_mermaid("fawatir_backend/api/models.py")
    
    with open("SAD_and_SDD.md", "r", encoding="utf-8") as f:
        doc = f.read()
        
    # Replace the old section
    doc = re.sub(r'### 3\.3 Database Entity-Relationship Model.*?<div class="page-break"></div>', mermaid_markdown + '<div class="page-break"></div>', doc, flags=re.DOTALL)
    
    with open("SAD_and_SDD.md", "w", encoding="utf-8") as f:
        f.write(doc)
    print("Done generating ER diagrams")

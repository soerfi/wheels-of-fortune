import json
import os

locales_dir = 'src/locales'
langs = {
    'de': "Hier geht's zum Shop",
    'en': "Go to the Shop",
    'fr': "Aller à la boutique",
    'it': "Vai al negozio"
}

for lang, text in langs.items():
    json_path = os.path.join(locales_dir, lang, 'translation.json')
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if 'wheel' in data:
            data['wheel']['shop_button'] = text
        
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)

print("Translations updated!")

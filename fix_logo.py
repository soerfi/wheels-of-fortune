import re

with open('server.ts', 'r') as f:
    content = f.read()

# 1. Resize the logo by 20%
# Currently: width="600" style="width: 100%; max-width: 600px; display: block; border: 0;"
# We will change width to 80% and max-width to 480px, and center it
old_logo = r'''<img src="${appUrl}/10-years-skate.ch.png" alt="10 JAHRE SKATE.CH" width="600" style="width: 100%; max-width: 600px; display: block; border: 0;" />'''
new_logo = r'''<img src="${appUrl}/10-years-skate.ch.png" alt="10 JAHRE SKATE.CH" width="480" style="width: 80%; max-width: 480px; display: block; margin: 0 auto; border: 0;" />'''
content = content.replace(old_logo, new_logo)

# 2. Make "Du hast einen [...] gewonnen" larger
old_greeting = r'''                      <h2 style="color: #18181b; font-size: 20px; font-weight: 900; margin: 0 0 20px 0; line-height: 1.3;">
                        ${translatedDesc || defaultDesc[userLang] || defaultDesc['de']}
                      </h2>'''

new_greeting = r'''                      <h2 style="color: #18181b; font-size: 28px; font-weight: 900; margin: 0 0 20px 0; line-height: 1.3;">
                        ${translatedDesc || defaultDesc[userLang] || defaultDesc['de']}
                      </h2>'''
content = content.replace(old_greeting, new_greeting)

with open('server.ts', 'w') as f:
    f.write(content)

print("Updates applied to server.ts")

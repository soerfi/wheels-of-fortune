import re
import os

with open('server.ts', 'r') as f:
    content = f.read()

# 1. White background for the 10 years SKATE.CH image
old_header = r'''                  <!-- Brand and Campaign Context Header -->
                  <tr>
                    <td align="center" style="padding: 0; text-align: center; background-color: #18181b;">
                      <img src="${appUrl}/10-years-skate.ch.png" alt="10 JAHRE SKATE.CH" width="600" style="width: 100%; max-width: 600px; display: block; border: 0;" />
                    </td>
                  </tr>'''

new_header = r'''                  <!-- Brand and Campaign Context Header -->
                  <tr>
                    <td align="center" style="padding: 0; text-align: center; background-color: #ffffff;">
                      <img src="${appUrl}/10-years-skate.ch.png" alt="10 JAHRE SKATE.CH" width="600" style="width: 100%; max-width: 600px; display: block; border: 0;" />
                    </td>
                  </tr>'''

content = content.replace(old_header, new_header)

# 2. Make "Dein Gewinn" text bigger
old_gewinn = r'''                            <!-- 1. Type of Prize -->
                            <p style="color: #EF4444; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: bold; font-size: 16px; letter-spacing: 2px; margin: 0 0 10px 0; text-transform: uppercase;">
                              ${voucherText[userLang] || voucherText['de']}
                            </p>'''

new_gewinn = r'''                            <!-- 1. Type of Prize -->
                            <p style="color: #EF4444; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 900; font-size: 22px; letter-spacing: 3px; margin: 0 0 15px 0; text-transform: uppercase;">
                              ${voucherText[userLang] || voucherText['de']}
                            </p>'''

content = content.replace(old_gewinn, new_gewinn)

# 3. Move Disclaimer below the Button
old_disclaimer = r'''                  <!-- Rules / Disclaimer for the user -->
                  <tr>
                    <td align="center" style="padding: 0 40px 10px 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                      <p style="font-size: 11px; color: #a1a1aa; margin: 0; line-height: 1.5; text-align: left;">
                        Pro Person ist nur eine Teilnahme erlaubt. Preise werden ausschliesslich innerhalb der Schweiz versendet. Der Rechtsweg ist ausgeschlossen. Bei mehrfacher Teilnahme oder sonstiger missbräuchlicher Nutzung erlischt jeglicher Anspruch auf sämtliche Preise.
                      </p>
                    </td>
                  </tr>

'''

old_button = r'''                  <!-- CTA Button -->
                  <tr>
                    <td align="center" style="padding: 0 40px 40px 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                      <a href="https://skate.ch" style="display: inline-block; background-color: #EF4444; color: #ffffff; text-decoration: none; padding: 16px 40px; font-size: 16px; font-weight: 900; border-radius: 30px; text-transform: uppercase; letter-spacing: 1.5px;">
                        ${buttonText[userLang] || buttonText['de']}
                      </a>
                    </td>
                  </tr>'''

new_button_with_disclaimer = r'''                  <!-- CTA Button -->
                  <tr>
                    <td align="center" style="padding: 0 40px 30px 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                      <a href="https://skate.ch" style="display: inline-block; background-color: #EF4444; color: #ffffff; text-decoration: none; padding: 16px 40px; font-size: 16px; font-weight: 900; border-radius: 30px; text-transform: uppercase; letter-spacing: 1.5px;">
                        ${buttonText[userLang] || buttonText['de']}
                      </a>
                    </td>
                  </tr>
                  
                  <!-- Rules / Disclaimer for the user -->
                  <tr>
                    <td align="center" style="padding: 0 40px 30px 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                      <p style="font-size: 11px; color: #a1a1aa; margin: 0; line-height: 1.5; text-align: center;">
                        Pro Person ist nur eine Teilnahme erlaubt. Preise werden ausschliesslich innerhalb der Schweiz versendet. Der Rechtsweg ist ausgeschlossen. Bei mehrfacher Teilnahme oder sonstiger missbräuchlicher Nutzung erlischt jeglicher Anspruch auf sämtliche Preise.
                      </p>
                    </td>
                  </tr>'''

# Remove old disclaimer
content = content.replace(old_disclaimer, '')

# Replace button with new button + disclaimer
content = content.replace(old_button, new_button_with_disclaimer)

with open('server.ts', 'w') as f:
    f.write(content)

print("Updates applied to server.ts")

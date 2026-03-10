import re
import os

with open('server.ts', 'r') as f:
    content = f.read()

# Fix fallback appUrl from winner.skate.ch to win.skate.ch
content = content.replace("'https://winner.skate.ch'", "'https://win.skate.ch'")

# Change "Dein Gutschein" to "Dein Gewinn" in voucherText
content = content.replace("de: 'Dein Gutschein'", "de: 'Dein Gewinn'")
content = content.replace("en: 'Your Voucher'", "en: 'Your Prize'")

# Now fix the description under the black box so it has more spacing, the correct font, and no italics
# We look for the "Short Description UNDER the box" chunk in the html string
old_desc_block = r'''                  <!-- Short Description UNDER the box -->
                  <tr>
                    <td align="center" style="padding: 0 40px 30px 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                      <p style="color: #3f3f46; font-size: 15px; margin: 0; line-height: 1.5; font-style: italic;">
                        ${translatedMailDesc || defaultMailDesc[userLang] || defaultMailDesc['de']}
                      </p>
                    </td>
                  </tr>'''

new_desc_block = r'''                  <!-- Short Description UNDER the box -->
                  <tr>
                    <td align="center" style="padding: 25px 40px 40px 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                      <p style="color: #3f3f46; font-size: 15px; margin: 0; line-height: 1.6;">
                        ${translatedMailDesc || defaultMailDesc[userLang] || defaultMailDesc['de']}
                      </p>
                    </td>
                  </tr>'''

content = content.replace(old_desc_block, new_desc_block)

# Also ensure "Gültig bis 30. April 2026" uses the translation string variable cleanly
old_validity = r'''                            <!-- 5. Validity -->
                            <p style="color: #a1a1aa; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; margin: 25px 0 0 0; text-transform: uppercase; font-weight: bold;">
                              ${validUntil[userLang] || validUntil['de']} 30. April 2026
                            </p>'''

new_validity = r'''                            <!-- 5. Validity -->
                            <p style="color: #a1a1aa; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; margin: 25px 0 0 0; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">
                              ${validUntil[userLang] || validUntil['de']}
                            </p>'''

content = content.replace(old_validity, new_validity)

with open('server.ts', 'w') as f:
    f.write(content)

print("Updates applied to server.ts")

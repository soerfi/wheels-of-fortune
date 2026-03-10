import re
import json
import os

# 1. Update server.ts email template
with open('server.ts', 'r') as f:
    content = f.read()

# Build the new email template block matching the user's specs:

new_html = r'''              <div style="background-color: #f4f4f5; padding: 40px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
                  
                  <!-- Brand and Campaign Context Header -->
                  <tr>
                    <td align="center" style="padding: 0; text-align: center; background-color: #18181b;">
                      <img src="${appUrl}/10-years-skate.ch.png" alt="10 JAHRE SKATE.CH" width="600" style="width: 100%; max-width: 600px; display: block; border: 0;" />
                    </td>
                  </tr>
                  
                  <!-- Short Email Context -->
                  <tr>
                    <td align="center" style="padding: 20px 20px 0 20px; text-align: center;">
                      <p style="color: #71717a; font-size: 14px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0;">${thankYouText[userLang] || thankYouText['de']}</p>
                    </td>
                  </tr>
                  
                  <!-- Personal Greeting & Pop-up Description instead of win statement -->
                  <tr>
                    <td align="center" style="padding: 30px 40px 10px 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                      <p style="font-size: 16px; color: #3f3f46; margin: 0 0 10px 0; font-weight: bold;">
                        ${heyText[userLang] || heyText['de']} ${winner.first_name || winner.user_name},
                      </p>
                      <h2 style="color: #18181b; font-size: 20px; font-weight: 900; margin: 0 0 20px 0; line-height: 1.3;">
                        ${translatedDesc || defaultDesc[userLang] || defaultDesc['de']}
                      </h2>
                    </td>
                  </tr>
                  
                  <!-- Visual Prize Box -->
                  <tr>
                    <td align="center" style="padding: 0 40px 15px 40px;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #18181b; border-radius: 12px; border: 2px solid #EF4444;">
                        <tr>
                          <td align="center" style="padding: 40px 30px;">
                            
                            <!-- 1. Type of Prize -->
                            <p style="color: #EF4444; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: bold; font-size: 16px; letter-spacing: 2px; margin: 0 0 10px 0; text-transform: uppercase;">
                              ${voucherText[userLang] || voucherText['de']}
                            </p>
                            
                            <!-- 2. Value Name -->
                            <h3 style="color: #ffffff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 38px; font-weight: 900; margin: 0 0 25px 0; line-height: 1.1;">
                              ${translatedName || winner.value || winner.prize_value}
                            </h3>
                            
                            <!-- 3. Voucher Code -->
                            <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                              <tr>
                                <td align="center" style="background: #ffffff; padding: 15px 30px; border-radius: 8px;">
                                  <p style="color: #71717a; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; margin: 0 0 5px 0; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">
                                    ${codeText[userLang] || codeText['de']}
                                  </p>
                                  <p style="color: #18181b; font-family: 'Courier New', Courier, monospace; font-size: 28px; font-weight: 900; margin: 0; letter-spacing: 2px;">
                                    ${winner.code}
                                  </p>
                                </td>
                              </tr>
                            </table>
                            
                            <!-- 4. Conditions (Min Order) -->
                            ${translatedMinOrder ? `<div style="margin-top: 25px;"><p style="color: #ef4444; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; margin: 0; font-weight: bold; background: rgba(239, 68, 68, 0.1); display: inline-block; padding: 6px 12px; border-radius: 4px;">${translatedMinOrder}</p></div>` : ``}
                            
                            <!-- 5. Validity -->
                            <p style="color: #a1a1aa; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; margin: 25px 0 0 0; text-transform: uppercase; font-weight: bold;">
                              ${validUntil[userLang] || validUntil['de']} 30. April 2026
                            </p>
                            
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Short Description UNDER the box -->
                  <tr>
                    <td align="center" style="padding: 0 40px 30px 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                      <p style="color: #3f3f46; font-size: 15px; margin: 0; line-height: 1.5; font-style: italic;">
                        ${translatedMailDesc || defaultMailDesc[userLang] || defaultMailDesc['de']}
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Rules / Disclaimer for the user -->
                  <tr>
                    <td align="center" style="padding: 0 40px 10px 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                      <p style="font-size: 11px; color: #a1a1aa; margin: 0; line-height: 1.5; text-align: left;">
                        Pro Person ist nur eine Teilnahme erlaubt. Preise werden ausschliesslich innerhalb der Schweiz versendet. Der Rechtsweg ist ausgeschlossen. Bei mehrfacher Teilnahme oder sonstiger missbräuchlicher Nutzung erlischt jeglicher Anspruch auf sämtliche Preise.
                      </p>
                    </td>
                  </tr>

                  <!-- Short Usage Instructions -->
                  <tr>
                    <td align="center" style="padding: 10px 40px 30px 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                      <p style="font-size: 15px; color: #3f3f46; margin: 0; line-height: 1.6;">
                        ${translatedMailInst ? translatedMailInst.replace(/\n/g, '<br>') : (defaultMailInst[userLang] || defaultMailInst['de'])}
                      </p>
                    </td>
                  </tr>
                  
                  <!-- CTA Button -->
                  <tr>
                    <td align="center" style="padding: 0 40px 40px 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                      <a href="https://skate.ch" style="display: inline-block; background-color: #EF4444; color: #ffffff; text-decoration: none; padding: 16px 40px; font-size: 16px; font-weight: 900; border-radius: 30px; text-transform: uppercase; letter-spacing: 1.5px;">
                        ${buttonText[userLang] || buttonText['de']}
                      </a>
                    </td>
                  </tr>
                  
                  <!-- Optional Brand Footer -->
                  <tr>
                     <td align="center" style="padding: 30px; background-color: #f4f4f5; text-align: center;">
                        <p style="color: #18181b; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 900; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px;">Keep Rolling.</p>
                        <p style="color: #a1a1aa; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; margin: 0;">&copy; 2026 SKATE.CH</p>
                     </td>
                  </tr>
                </table>
              </div>'''

# We also need to add translatedDesc and defaultDesc since they might not be defined in server.ts
# Let's check where variables are defined
# Assuming `const translatedDesc = prize.description_de;` or similar is already parsed, but wait, do we have translatedDesc?
# In previous code they have translatedName and translatedMailDesc and translatedMinOrder.
# Let's inject defaultDesc

default_desc = "           const defaultDesc: any = { en: 'Here is your prize:', fr: 'Voici votre prix :', it: 'Ecco il tuo premio:', de: 'Hier ist dein Gewinn:' };"

pattern = r'(html\s*:\s*`)(.*?)(`\s*\n\s*\}\);)'
replacement = r'\1\n' + new_html + r'\n            \3'

# we also need to inject defaultDesc near the other constants if not there, or just define it in line.
# let's just use string replacement for the html first
new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Add defaultDesc definition if missing
if 'const defaultDesc' not in new_content:
    new_content = new_content.replace('const buttonText: any =', defaultDesc + '\n          const buttonText: any =')

with open('server.ts', 'w') as f:
    f.write(new_content)


# 2. Update frontend Disclaimer in all translation files
disclaimer_de = "Teilnahmeberechtigt sind nur Personen mit Wohnsitz in der Schweiz. Pro Person ist nur eine Teilnahme erlaubt. Preise werden ausschliesslich innerhalb der Schweiz versendet. Der Rechtsweg ist ausgeschlossen. Mit dem Klick auf «SPIN NOW!» erklärst du dich damit einverstanden. Bei mehrfacher Teilnahme oder sonstiger missbräuchlicher Nutzung erlischt jeglicher Anspruch auf sämtliche Preise."
disclaimer_en = "Only persons residing in Switzerland are eligible to participate. Only one entry per person is permitted. Prizes will only be shipped within Switzerland. Legal recourse is excluded. By clicking \"SPIN NOW!\" you agree to these terms. In the event of multiple entries or other fraudulent use, all claims to any prizes will be voided."
disclaimer_fr = "Seules les personnes résidant en Suisse sont autorisées à participer. Une seule participation par personne est autorisée. Les prix seront exclusivement expédiés en Suisse. Tout recours légal est exclu. En cliquant sur « SPIN NOW! », vous acceptez ces conditions. En cas de participations multiples ou de toute autre utilisation abusive, tout droit aux prix sera annulé."
disclaimer_it = "Sono ammesse a partecipare solo le persone residenti in Svizzera. È consentita una sola partecipazione per persona. I premi saranno spediti esclusivamente in Svizzera. Sono escluse le vie legali. Cliccando su \"SPIN NOW!\" accetti queste condizioni. In caso di partecipazioni multiple o altro uso fraudolento, decadrà ogni diritto a qualsiasi premio."

locales_dir = 'src/locales'
langs = {'de': disclaimer_de, 'en': disclaimer_en, 'fr': disclaimer_fr, 'it': disclaimer_it}

for lang, text in langs.items():
    json_path = os.path.join(locales_dir, lang, 'translation.json')
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if 'wheel' in data and 'disclaimer' in data['wheel']:
            data['wheel']['disclaimer'] = text
        
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)

print("Updates applied successfully.")

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'server.ts');
let content = fs.readFileSync(file, 'utf8');

const newTemplate = `\`
              <div style="background-color: #f4f4f5; padding: 40px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
                  
                  <!-- Brand and Campaign Context Header -->
                  <tr>
                    <td align="center" style="padding: 0; text-align: center; background-color: #18181b;">
                      <img src="\${appUrl}/10years_skate.svg" alt="10 JAHRE SKATE.CH" width="600" style="width: 100%; max-width: 600px; display: block; border: 0;" />
                    </td>
                  </tr>
                  
                  <!-- Short Email Context -->
                  <tr>
                    <td align="center" style="padding: 20px 20px 0 20px; text-align: center;">
                      <p style="color: #71717a; font-size: 14px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0;">\${thankYouText[userLang] || thankYouText['de']}</p>
                    </td>
                  </tr>
                  
                  <!-- Personal Greeting & Clear Win Statement -->
                  <tr>
                    <td align="center" style="padding: 30px 40px 10px 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                      <p style="font-size: 16px; color: #3f3f46; margin: 0 0 10px 0; font-weight: bold;">
                        \${heyText[userLang] || heyText['de']} \${winner.first_name || winner.user_name},
                      </p>
                      <h2 style="color: #18181b; font-size: 24px; font-weight: 900; margin: 0 0 20px 0; line-height: 1.3;">
                        Du hast einen \${winner.value || winner.prize_value || translatedName} gewonnen!
                      </h2>
                    </td>
                  </tr>
                  
                  <!-- Visual Prize Box -->
                  <tr>
                    <td align="center" style="padding: 0 40px 30px 40px;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #18181b; border-radius: 12px; border: 2px solid #EF4444;">
                        <tr>
                          <td align="center" style="padding: 40px 30px;">
                            
                            <!-- 1. Type of Prize -->
                            <p style="color: #EF4444; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: bold; font-size: 12px; letter-spacing: 2px; margin: 0 0 10px 0; text-transform: uppercase;">
                              \${voucherText[userLang] || voucherText['de']}
                            </p>
                            
                            <!-- 2. Value -->
                            <h3 style="color: #ffffff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 38px; font-weight: 900; margin: 0 0 15px 0; line-height: 1.1;">
                              \${winner.value || winner.prize_value || translatedName}
                            </h3>
                            
                            <!-- 3. Short Description -->
                            <p style="color: #d4d4d8; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; margin: 0 0 10px 0;">
                              \${translatedMailDesc || defaultMailDesc[userLang] || defaultMailDesc['de']}
                            </p>
                            
                            <!-- 4. Conditions (Min Order) -->
                            \${translatedMinOrder ? \`<p style="color: #ef4444; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; margin: 0 0 35px 0; font-weight: bold; background: rgba(239, 68, 68, 0.1); display: inline-block; padding: 4px 10px; border-radius: 4px;">\${translatedMinOrder}</p>\` : \`<div style="height: 25px;"></div>\`}
                            
                            <!-- 5. Voucher Code -->
                            <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                              <tr>
                                <td align="center" style="background: #ffffff; padding: 15px 30px; border-radius: 8px;">
                                  <p style="color: #71717a; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; margin: 0 0 5px 0; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">
                                    \${codeText[userLang] || codeText['de']}
                                  </p>
                                  <p style="color: #18181b; font-family: 'Courier New', Courier, monospace; font-size: 28px; font-weight: 900; margin: 0; letter-spacing: 2px;">
                                    \${winner.code}
                                  </p>
                                </td>
                              </tr>
                            </table>
                            
                            <!-- 6. Validity -->
                            <p style="color: #a1a1aa; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; margin: 25px 0 0 0; text-transform: uppercase; font-weight: bold;">
                              \${validUntil[userLang] || validUntil['de']}
                            </p>
                            
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Short Usage Instructions -->
                  <tr>
                    <td align="center" style="padding: 10px 40px 30px 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                      <p style="font-size: 15px; color: #3f3f46; margin: 0; line-height: 1.6;">
                        \${translatedMailInst ? translatedMailInst.replace(/\\\\n/g, '<br>').replace(/\\n/g, '<br>') : (defaultMailInst[userLang] || defaultMailInst['de'])}
                      </p>
                    </td>
                  </tr>
                  
                  <!-- CTA Button -->
                  <tr>
                    <td align="center" style="padding: 0 40px 40px 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                      <a href="https://skate.ch" style="display: inline-block; background-color: #EF4444; color: #ffffff; text-decoration: none; padding: 16px 40px; font-size: 16px; font-weight: 900; border-radius: 30px; text-transform: uppercase; letter-spacing: 1.5px;">
                        \${buttonText[userLang] || buttonText['de']}
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
              </div>
            \``;

const targetLineStart = 'html: `';
const startIdx = content.indexOf(targetLineStart);

if (startIdx !== -1) {
  content = content.substring(0, startIdx + 6) + newTemplate + content.substring(startIdx + 7);
  fs.writeFileSync(file, content);
  console.log('Template inserted successfully');
} else {
  console.log('Failed to find html: ` insertion point');
}

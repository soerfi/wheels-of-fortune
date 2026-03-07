import 'dotenv/config';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

async function sendTestEmail() {
    const user_email = 'soerfi@illumate.ch';
    const userLang = 'de';
    const winner = {
        first_name: 'Markus',
        user_name: 'Markus Schweingruber',
        code: 'GUTSCHEIN-TEST1234',
        prize_value: null,
        value: 'CHF 50.-'
    };

    const appUrl = process.env.VITE_APP_URL || 'https://winner.skate.ch';
    const backgroundUrl = `${appUrl}/Mail-Background.jpg`;

    const translatedName = 'SKATE.CH Gutschein';
    const translatedMailDesc = 'Einlösbar bei deinem nächsten Einkauf im Shop';
    const translatedMailInst = 'Besuche einfach unseren Webshop und gib deinen Gutscheincode direkt am Ende des Bestellvorgangs ein.';

    const subject = 'Dein SKATE.CH Gewinn zum 10-jährigen Jubiläum!';
    const thankYouText = 'Vielen Dank für deine Teilnahme am Gewinnspiel!';
    const heyText = 'Hey';
    const introText = 'Wir freuen uns sehr – du hast an unserem Wheel of Fortune gedreht und kräftig abgeräumt! Hier ist dein Gewinn:';
    const voucherText = 'Dein Gutschein';
    const codeText = 'Gutscheincode';
    const validUntil = 'Gültig bis 30. April 2026';
    const finalGreeting = 'Wir freuen uns auf dich!<br>Keep Rolling.';
    const buttonText = 'Jetzt online einlösen';

    console.log('Sending test email to', user_email);

    try {
        const data = await resend.emails.send({
            from: process.env.FROM_EMAIL || 'gewinn@winner.skate.ch',
            to: user_email,
            subject: subject,
            html: `
        <div style="background-color: #f4f4f5; padding: 40px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
            <tr>
              <td align="center" style="padding: 30px 20px 20px 20px; text-align: center;">
                <h1 style="color: #EF4444; font-size: 28px; font-weight: 900; letter-spacing: 2px; margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">10 JAHRE SKATE.CH</h1>
                <p style="color: #71717a; font-size: 16px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin-top: 10px;">${thankYouText}</p>
              </td>
            </tr>
            
            <tr>
              <td style="padding: 10px 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                ${heyText} <strong>${winner.first_name}</strong>,<br><br>
                ${introText}<br>
                <strong style="color: #EF4444; font-size: 18px;">${translatedName}</strong>
              </td>
            </tr>
            
            <tr>
              <td style="padding: 30px 40px;">
                <!-- Graphic Voucher Box -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" background="${backgroundUrl}" style="background-image: url('${backgroundUrl}'); background-size: cover; background-position: center; border-radius: 12px; background-color: #18181b; border: 3px solid #EF4444;">
                  <tr>
                    <!-- Added dark fallback overlay for text readability -->
                    <td style="background: rgba(0,0,0,0.65); border-radius: 9px; padding: 40px 30px; text-align: left;">
                      <p style="color: #EF4444; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: bold; font-size: 14px; letter-spacing: 2px; margin: 0; text-transform: uppercase;">${voucherText}</p>
                      
                      <h2 style="color: #ffffff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 34px; font-weight: 900; margin: 8px 0 10px 0;">${winner.value || winner.prize_value || translatedName}</h2>
                      <p style="color: #d4d4d8; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; margin: 0 0 35px 0; font-style: italic;">${translatedMailDesc}</p>
                      
                      <table cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="background: #ffffff; padding: 12px 25px; border-radius: 6px; text-align: center;">
                            <p style="color: #71717a; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; margin: 0; text-transform: uppercase; font-weight: bold;">${codeText}</p>
                            <p style="color: #18181b; font-family: 'Courier New', Courier, monospace; font-size: 26px; font-weight: 900; margin: 5px 0 0 0; letter-spacing: 3px;">${winner.code}</p>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="color: #a1a1aa; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; margin-top: 30px; margin-bottom: 0; text-transform: uppercase; font-weight: bold;">${validUntil}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            
            <tr>
              <td align="center" style="padding: 20px 40px 40px 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                <p style="font-size: 16px; color: #3f3f46; margin-bottom: 25px; line-height: 1.6;">
                  ${translatedMailInst}<br><br>${finalGreeting}
                </p>
                <a href="https://skate.ch" style="display: inline-block; background-color: #EF4444; color: #ffffff; text-decoration: none; padding: 16px 36px; font-weight: bold; border-radius: 30px; text-transform: uppercase; letter-spacing: 1.5px; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);">${buttonText}</a>
              </td>
            </tr>
            
            <tr>
               <td align="center" style="padding: 20px; background-color: #f4f4f5; text-align: center;">
                  <p style="color: #a1a1aa; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; margin: 0;">&copy; 2026 SKATE.CH – Keep Rolling.</p>
               </td>
            </tr>
          </table>
        </div>
      `
        });
        console.log('Email sent successfully!', data);
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

sendTestEmail();

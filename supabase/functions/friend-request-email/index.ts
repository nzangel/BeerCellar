import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SENDER_EMAIL = 'beercellar@quelmatoschoisir.fr';
const SENDER_NAME = 'BeerCellar';

Deno.serve(async (req) => {
  try {
    const payload = await req.json();

    // On ne traite que les INSERT avec status 'pending'
    if (payload.type !== 'INSERT' || payload.record?.status !== 'pending') {
      return new Response('Ignored', { status: 200 });
    }

    const { requester_id, addressee_id } = payload.record;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Récupérer l'email du destinataire
    const { data: { user: addressee } } = await supabase.auth.admin.getUserById(addressee_id);
    if (!addressee?.email) return new Response('No email', { status: 200 });

    // Récupérer le profil de l'expéditeur
    const { data: requester } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', requester_id)
      .single();

    if (!requester?.username) return new Response('No profile', { status: 200 });

    // Envoyer l'email via Brevo
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: addressee.email }],
        subject: `@${requester.username} vous a envoyé une demande d'ami 🍺`,
        htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#1a0a00;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a0a00;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">

          <!-- Logo / Titre -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <div style="font-size:40px;margin-bottom:8px;">🍺</div>
              <div style="font-size:26px;font-weight:800;color:#f5a623;letter-spacing:-0.5px;">BeerCellar</div>
            </td>
          </tr>

          <!-- Carte principale -->
          <tr>
            <td style="background-color:#2a1500;border-radius:16px;border:1px solid #3d2200;padding:32px;">

              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;">
                Nouvelle demande d'ami
              </p>
              <p style="margin:0 0 24px;font-size:16px;color:#a07850;line-height:1.5;">
                <strong style="color:#f5a623;">@${requester.username}</strong> souhaite t'ajouter en ami sur BeerCellar.
              </p>

              <!-- Bouton -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="beercellar://community"
                       style="display:inline-block;background-color:#f5a623;color:#1a0a00;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">
                      Voir la demande
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-size:13px;color:#6b4c2a;text-align:center;line-height:1.5;">
                Si le bouton ne fonctionne pas, ouvre l'application BeerCellar et consulte l'onglet Communauté.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#4a3020;">
                Tu reçois cet email car tu as un compte BeerCellar.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Brevo error:', err);
      return new Response(`Brevo error: ${err}`, { status: 500 });
    }

    return new Response('Email sent', { status: 200 });

  } catch (e) {
    console.error(e);
    return new Response('Error', { status: 500 });
  }
});

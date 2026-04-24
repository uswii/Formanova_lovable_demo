import os, requests
B="https://volhgtspbvgxavqgueqc.supabase.co/storage/v1/object/public/email-assets"
html=open('scripts/marketing-email/email.html').read()
for k,v in {
  "cid:logo@formanova": f"{B}/logo.png",
  "cid:ringraw@formanova": f"{B}/ring-raw.jpg",
  "cid:ringstyled@formanova": f"{B}/ring-styled.jpg",
  "cid:icinsta": f"{B}/ic-instagram.png",
  "cid:iclinkedin": f"{B}/ic-linkedin.png",
  "cid:icemail": f"{B}/ic-email.png",
}.items(): html=html.replace(k,v)
r=requests.post("https://api.resend.com/emails",
  headers={"Authorization":f"Bearer {os.environ['RESEND_API_KEY']}","Content-Type":"application/json"},
  json={"from":"FormaNova <hello@formanova.ai>","to":["uswa@raresense.so"],
        "subject":"New: Create stunning product shots of your jewelry now","html":html})
print(r.status_code, r.text)

# SMART SHOOTS - Cloud deployment (reachable from anywhere)

This runs the **same Django backend** used by the desktop app on a small,
always-on cloud server instead of your PC, with a real, trusted HTTPS
certificate handled automatically. Point the Android app's
**Settings > Server Address** at it, and it works over any internet
connection - not just your home Wi-Fi.

This is a genuine, if small, piece of infrastructure to run and be
responsible for (it's reachable from the internet, not just your LAN) -
worth reading through once before starting rather than just copy-pasting
commands.

## 1. Get a small VPS
Any of these work fine for this app's scale (~$5-6/month, cheapest
tier is enough):
- [Hetzner Cloud](https://www.hetzner.com/cloud/) (usually cheapest)
- [DigitalOcean](https://www.digitalocean.com/)
- [Linode/Akamai](https://www.linode.com/)
- AWS Lightsail

Pick **Ubuntu 24.04 LTS** when creating it. Note the server's public IP
address once it's up.

## 2. Point a domain at it
Caddy (the reverse proxy this uses) needs a real domain name to get a
Let's Encrypt certificate - a bare IP address can't get a trusted HTTPS
cert.

- **If you already own a domain:** add an `A` record for a subdomain
  (e.g. `smartshoots.yourdomain.com`) pointing at the VPS's IP.
- **If you don't:** [DuckDNS](https://www.duckdns.org/) gives you a free
  subdomain (`yourname.duckdns.org`) pointing at any IP you tell it to -
  takes about two minutes to set up, no cost, no card required.

Either way, wait a few minutes for DNS to propagate before continuing -
you can check with `nslookup yourdomain.here` from your own PC.

## 3. Install Docker on the VPS
SSH into the server, then:
```bash
curl -fsSL https://get.docker.com | sh
```
(This is Docker's own official install script - works on a fresh Ubuntu
server with no extra setup.)

## 4. Copy the project to the server
From your PC (adjust the path/IP):
```bash
scp -r SMART-SHOOTS root@YOUR_SERVER_IP:/opt/smartshoots
```
Or, if you've pushed this to a private git repo, `git clone` it on the
server instead - either is fine.

## 5. Configure it
On the server:
```bash
cd /opt/smartshoots
cp .env.example .env
nano .env   # fill in DOMAIN, a real SMARTSHOOTS_SECRET_KEY, and an admin password
```
Generate a real secret key rather than leaving the placeholder:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

## 6. Start it
```bash
docker compose up -d --build
```
First run takes a few minutes (builds the frontend + backend images,
Caddy requests the certificate). Check on it with:
```bash
docker compose logs -f
```
You're looking for `SMARTSHOOTS_READY` from the backend and no repeated
certificate errors from caddy.

## 7. Open the firewall
Most VPS providers block ports by default. Make sure 80 and 443 are
open - either via the provider's dashboard firewall, or with `ufw` on
the server itself:
```bash
ufw allow 80
ufw allow 443
ufw allow OpenSSH
ufw enable
```
(port 80 is needed too, even though everything ends up on 443 - Caddy
uses it briefly during the Let's Encrypt certificate challenge.)

## 8. Verify
Visit `https://yourdomain.here` in a browser - you should see the actual
SMART SHOOTS login screen, with a valid padlock/certificate. Log in with
`admin` and whatever you set as `SMARTSHOOTS_ADMIN_PASSWORD` - **change
that password from Settings immediately**, since this account is now
reachable from the whole internet, not just your PC.

## 9. Point your devices at it
- **Android app:** Settings > Server Address ->
  `https://yourdomain.here` (no port needed, Caddy serves standard 443).
- **Desktop app:** currently runs its own local backend by default and
  isn't wired up to use a remote server address - let me know if you
  want that changed so the Windows app can optionally point here too and
  share one database with the phone, rather than each keeping separate
  local data.

## Moving your existing local data to the cloud server
If you already have clients/orders/payments on your PC and want the
cloud server to start with that data instead of empty, use the app's own
Backup & Restore (Settings) - this has been tested end-to-end for
exactly this move:

1. On your PC (the "This computer" instance): **Settings > Backup &
   Restore > Backup**, save the downloaded file somewhere.
2. Deploy the cloud server (steps above) and log in with its own admin
   account/password - **don't create any extra staff accounts yet**.
3. **Settings > Backup & Restore > Restore**, choose the file from step 1.
4. Log out and back in - your clients, orders, payments, expenses, etc.
   are now on the cloud server, reachable from both the phone and the PC.

This works reliably when restoring onto a **freshly-deployed** server
(step 2's condition above) - the backup deliberately doesn't include
login accounts (those are specific to each install, not portable
business data), and a couple of record types reference "who created
this," which only lines up correctly if the target's admin account is
still the very first account created on that install. Restoring onto a
server that already has other staff accounts set up isn't supported by
this flow.

## Updating after a code change
```bash
cd /opt/smartshoots
# copy over your changed files, or git pull
docker compose up -d --build
```
Existing data (the SQLite database, uploaded files) lives in a Docker
volume and survives this - it's not part of the image being rebuilt.

## Backups
The in-app **Settings > Backup & Restore** still works exactly as
before and is the easiest way to get a downloadable backup. For a raw
file-level backup of the volume itself, first find its exact name
(Docker Compose prefixes it with the project/folder name, so this
depends on what you named the folder in step 4):
```bash
docker volume ls | grep smartshoots_data
```
Then, using whatever name that showed:
```bash
docker compose stop backend
docker run --rm -v <volume_name_from_above>:/data -v $(pwd):/backup alpine \
  tar czf /backup/smartshoots-backup-$(date +%Y%m%d).tar.gz -C /data .
docker compose start backend
```

## Security notes worth actually reading
- This server is reachable by anyone who finds its address, not just
  you - there's currently one shared admin account, no per-request rate
  limiting beyond what's built into Django/DRF, and no additional
  network-level access restriction. Fine for personal use where the
  address isn't public/guessable, but don't treat it as hardened against
  a determined attacker.
- Keep `.env` private - it holds your secret key and admin password.
  Don't commit it to a public git repo.
- If you ever suspect the admin password has leaked, change it
  immediately from Settings, and consider rotating `SMARTSHOOTS_SECRET_KEY`
  too (this invalidates all existing login tokens - everyone has to log
  in again, which is the point).

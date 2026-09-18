# Edge Landings domain setup

## Main site and website service

- www.edgelandings.com and edgelandings.com: project hub (existing Vercel project).
- websites.edgelandings.com: website-service homepage, served by the SAME Vercel project.
- /websites.html: working website-service link on the main domain until its subdomain is connected.
- Existing pricing, examples, audit, onboarding, and contact routes remain available.

In Vercel, open edge-landings > Settings > Domains > Add Existing. Add
websites.edgelandings.com and connect it to Production (not a redirect).
Copy the DNS target Vercel shows into a new IONOS CNAME with host websites.
Vercel's currently supplied target for this project is
3bde618fe307382b.vercel-dns-017.com; prefer the exact value shown after adding
the new domain. No transfer or nameserver change is required.

The server recognizes the exact websites.edgelandings.com hostname and serves
site/websites.html at / and /index.html. Other hosts receive the project hub.

## Railway projects

The following REAL custom domains have been attached in Railway. Add these
records in IONOS > edgelandings.com > DNS > Add record > CNAME:

| Host | Points to |
| --- | --- |
| tax | mjviqtdx.up.railway.app |
| leads | uo1dpagk.up.railway.app |

Leave TTL at the default. Railway returned no additional verification record
for these domain creations. Follow Railway's domain status if additional
verification is later requested. Wait for DNS and certificates to verify.
Do not change the existing @, www, MX, SPF, DKIM, or DMARC records.

- Tax: Tax-Delinquencies, project imaginative-creation.
- Leads: city-leads-dashboard, project agile-vitality, target port 8080.

Until domain verification and app review finish, hub cards open local project
information pages with a contact option. They do not link to broken subdomains
or expose Railway addresses. Once verified, replace the tax and leads card
links in site/index.html with https://tax.edgelandings.com and
https://leads.edgelandings.com. Replace the website card link with
https://websites.edgelandings.com after Vercel confirms it.

## Application settings

For the website service, APP_URL should eventually be
https://websites.edgelandings.com so checkout returns to that host. Keep the
existing value until the new host is verified. Update the Stripe webhook
URL only after the hostname is live; use the signing secret belonging to that
endpoint.

Other apps may need public URL, OAuth callback, billing-return, and allowed
host settings updated in their own projects. Review these and test login and
checkout on their new subdomains before changing hub links.

This repository cannot add cross-project branding or back links to other
apps; those edits belong in each app's own repository. Other Railway services
are not listed publicly until their purpose and customer-facing readiness are
confirmed.

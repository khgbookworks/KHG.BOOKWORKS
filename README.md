# KHG Bookworks
Premium author-services portfolio built as a lightweight static website with a Google Apps Script backend.

## Pages
Home, About, Services, Pricing, Portfolio, Reviews and Contact.

## Brand
Royal blue, white and restrained gold accents. Responsive layout, animated cover presentations, accessible navigation and reduced-motion support.

## Setup the Google Sheets backend
1. Create a Google Sheet for KHG Bookworks.
2. Open Extensions → Apps Script.
3. Paste the complete contents of `apps-script/Code.gs`.
4. Save and run `setup()` once. Approve the requested permissions.
5. Deploy → New deployment → Web app. Execute as **Me** and set access to **Anyone**.
6. Copy the deployed Web App URL into `window.KHG.API` in `js/config.js`.
7. After any Apps Script changes, deploy a new version.

The script creates Requests, Reviews and Projects tabs. New reviews and project approvals are marked Pending. Change Status to Approved or Rejected in the corresponding sheet. Only Approved entries are returned by the public read endpoint. Project rows must be marked Approved before display.

## Notifications
Project requests, reviews and project submissions are emailed to khg.bookworks@gmail.com. The script runs as the spreadsheet owner and requires MailApp authorization.

## Analytics
The GA4 measurement ID is configured in `js/config.js`. Confirm that the measurement ID belongs to the intended GA4 property.

## Portrait and cover assets
The portrait file is expected at `assets/harun.png`. Add the original portrait there to display it on About. Cover concept artwork is supplied as editable SVG files under `assets/covers/`. The From Hawking to Potential SVG is a simplified vector recreation of the supplied cover layout; replace it with the original high-resolution cover artwork when available.

## Deploy
This is a static site. GitHub Pages or Netlify can publish the repository root. Configure the deployment to use the `main` branch after the rebuild pull request has been reviewed and merged. Do not publish the placeholder Apps Script URL; deploy the script first and replace it in config.js.

## Security
No spreadsheet ID, OAuth secret or private token belongs in frontend code. Review and project moderation are performed in the private Google Sheet. Public endpoints return approved entries only.

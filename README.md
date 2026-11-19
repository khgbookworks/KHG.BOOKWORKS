# KHG Bookworks portfolio

## 1. Connect the Google Sheet (reviews, requests, projects)
1. Create a new Google Sheet. Open Extensions > Apps Script.
2. Paste `apps-script/Code.gs`. Change `OWNER` to your email.
3. Run `setup` once and allow access. This creates the Reviews, Requests and Projects tabs.
4. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone. Copy the Web app URL.
5. Paste that URL into `API` in `js/config.js`. Also set `EMAIL`, `FIVERR` and `GA`.

## 2. Approving content
- Reviews: set Status to Approved or Rejected in the Reviews tab. Only Approved shows on the site.
- Projects: add rows yourself, or authors submit from the Projects page. Set Status to Approved after the project is complete.
- Image cells accept Google Drive share links (set sharing to "Anyone with the link").
- Requests: every new request is added to the Requests tab and emailed to you.

## 3. Google Analytics
Create a GA4 property, copy the measurement ID (G-XXXXXXXXXX) into `GA` in `js/config.js`.

## 4. Publish on GitHub Pages
```
git init && git add . && git commit -m "Portfolio"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/khg-portfolio.git
git push -u origin main
```
Then Settings > Pages > Deploy from branch > main > / (root). Your link: https://YOUR-USERNAME.github.io/khg-portfolio/

After editing the Apps Script, redeploy with a new version so changes go live.

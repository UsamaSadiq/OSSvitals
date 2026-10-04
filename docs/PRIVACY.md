# Privacy

The dashboard shows public information about Open edX repositories. Some of it names people, by GitHub handle. It does not collect data from its visitors.

## What is shown about people

- **Repository owners.** The owner declared in each repository's public `catalog-info.yaml` (`spec.owner`), which may be a GitHub team or a person's GitHub handle. It appears on the Owners, At Risk, Components and Repo Detail pages.
- **Nothing else per person.** Activity signals such as newcomer pull requests, response times and commit counts are published only as per-repository totals and medians. No list of contributors or newcomers is shown.

## Where the data comes from

- The public repo health CSV published daily by the Open edX Maintenance Working Group in [openedx/wg-maintenance](https://github.com/openedx/wg-maintenance).
- Public files and metadata of public GitHub repositories, read by the dashboard's daily collectors.

## Corrections and removal

If you are named on the dashboard and something is wrong, or you want your handle removed, open an issue on [this repository](https://github.com/UsamaSadiq/OSSvitals/issues). Owner names come from the repository's `catalog-info.yaml`, so the lasting fix is a change to that file.

## Visitors

- No account or login is needed, and the dashboard sets no cookies.
- **Hosting:** the dashboard is a static site served by Cloudflare. Like any web host, Cloudflare processes the IP address and request details needed to deliver the pages; see [Cloudflare's privacy policy](https://www.cloudflare.com/privacypolicy/).
- **Analytics:** [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/) counts page views in aggregate: pages, referrers, countries and browser or device type. It uses no cookies and no local storage, and does not build visitor profiles.
- **Theme choice:** your dark or light choice is kept in your own browser's local storage and is never sent anywhere.
- **The previous Streamlit version:** while it stays online, it runs on Streamlit Community Cloud, whose own session cookies apply. Streamlit usage statistics are disabled in [.streamlit/config.toml](../.streamlit/config.toml).

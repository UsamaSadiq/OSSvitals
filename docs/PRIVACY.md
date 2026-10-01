# Privacy

The dashboard shows public information about Open edX repositories. Some of it names people, by GitHub handle. It does not collect data from its visitors.

## What is shown about people

- **Repository owners.** The owner declared in each repository's public `catalog-info.yaml` (`spec.owner`), which may be a GitHub team or a person's GitHub handle. It appears on the Owners, At Risk, Components and Repo Detail pages.
- **Nothing else per person.** Activity signals such as newcomer pull requests, response times and commit counts are published only as per-repository totals and medians. No list of contributors or newcomers is shown.

## Where the data comes from

- The public repo health CSV published daily by the Open edX Maintenance Working Group in [openedx/wg-maintenance](https://github.com/openedx/wg-maintenance).
- Public files and metadata of public GitHub repositories, read by the dashboard's daily collectors.

## Corrections and removal

If you are named on the dashboard and something is wrong, or you want your handle removed, open an issue on [this repository](https://github.com/UsamaSadiq/org-health-dashboard/issues). Owner names come from the repository's `catalog-info.yaml`, so the lasting fix is a change to that file.

## Visitors

- No account or login is needed and no personal data is collected from visitors.
- Streamlit usage statistics are disabled in [.streamlit/config.toml](../.streamlit/config.toml). No third-party analytics are included.
- Any cookies are the hosting platform's session cookies; the dashboard sets no tracking cookies.

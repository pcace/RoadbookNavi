use crate::store::{err, Result};
use semver::Version;
use serde::{Deserialize, Serialize};
use std::time::Duration;

const RELEASES_API: &str = "https://api.github.com/repos/pcace/RoadbookNavi/releases?per_page=20";
const RELEASES_PAGE: &str = "https://github.com/pcace/RoadbookNavi/releases/tag";
const MAX_RESPONSE_BYTES: usize = 512 * 1024;

#[derive(Debug, Deserialize)]
struct GithubRelease {
    tag_name: String,
    prerelease: bool,
    draft: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    current_version: String,
    latest_version: String,
    release_url: String,
    update_available: bool,
}

fn release_version(tag: &str) -> Option<Version> {
    Version::parse(tag.strip_prefix('v').unwrap_or(tag)).ok()
}

fn latest_release<'a>(
    releases: &'a [GithubRelease],
    current: &Version,
) -> Option<(&'a GithubRelease, Version)> {
    let include_prereleases = !current.pre.is_empty();
    releases
        .iter()
        .filter(|release| !release.draft && (include_prereleases || !release.prerelease))
        .filter_map(|release| release_version(&release.tag_name).map(|version| (release, version)))
        .max_by(|(_, left), (_, right)| left.cmp(right))
}

pub fn check(current_version: &str) -> Result<UpdateStatus> {
    let current = Version::parse(current_version).map_err(err)?;
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent(format!("RoadbookNavi/{current_version}"))
        .build()
        .map_err(err)?;
    let response = client
        .get(RELEASES_API)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .map_err(err)?
        .error_for_status()
        .map_err(err)?;
    if response
        .content_length()
        .is_some_and(|size| size > MAX_RESPONSE_BYTES as u64)
    {
        return Err("Die Release-Antwort ist zu groß".into());
    }
    let body = response.bytes().map_err(err)?;
    if body.len() > MAX_RESPONSE_BYTES {
        return Err("Die Release-Antwort ist zu groß".into());
    }
    let releases: Vec<GithubRelease> = serde_json::from_slice(&body).map_err(err)?;
    let (_, latest) = latest_release(&releases, &current)
        .ok_or_else(|| "Kein passendes RoadbookNavi-Release gefunden".to_string())?;
    Ok(UpdateStatus {
        current_version: current.to_string(),
        latest_version: latest.to_string(),
        release_url: format!("{RELEASES_PAGE}/v{latest}"),
        update_available: latest > current,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn release(tag: &str, prerelease: bool) -> GithubRelease {
        GithubRelease {
            tag_name: tag.to_owned(),
            prerelease,
            draft: false,
        }
    }

    #[test]
    fn stable_builds_ignore_prereleases() {
        let releases = vec![release("v2.0.0-beta.1", true), release("v1.5.0", false)];
        let (_, latest) = latest_release(&releases, &Version::parse("1.4.0").unwrap()).unwrap();
        assert_eq!(latest, Version::parse("1.5.0").unwrap());
    }

    #[test]
    fn beta_builds_receive_newer_betas() {
        let releases = vec![
            release("v1.5.0-beta.2", true),
            release("v1.5.0-beta.1", true),
            release("v1.4.0", false),
        ];
        let (_, latest) =
            latest_release(&releases, &Version::parse("1.5.0-beta.1").unwrap()).unwrap();
        assert_eq!(latest, Version::parse("1.5.0-beta.2").unwrap());
    }

    #[test]
    #[ignore = "Explicit live check against the GitHub Releases API"]
    fn github_release_check() {
        let status = check(env!("CARGO_PKG_VERSION")).unwrap();
        assert!(!status.latest_version.is_empty());
        assert!(status.release_url.starts_with(RELEASES_PAGE));
    }
}

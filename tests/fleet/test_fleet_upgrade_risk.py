from collectors.fleet.upgrade import migration_dir, migrations, release_notes

DIRS = ["migrations", "migrate"]


def test_migration_folders_are_found_and_test_trees_ignored():
    assert migration_dir("db/migrate/20261006_add.rb", DIRS) == "db/migrate"
    assert migration_dir("server/migrations/0042_add.py", DIRS) == "server/migrations"
    assert migration_dir("spec/db/migrate/add_spec.rb", DIRS) is None
    assert migration_dir("app/jobs/migration/replace_job.rb", DIRS) is None
    assert migration_dir("README.md", DIRS) is None


def test_both_sides_adding_migrations_to_one_folder_is_reported_with_shared_number_prefixes():
    ours = ["db/migrate/20261006120000_ours.rb", "server/migrations/0042_ours.py", "spec/db/migrate/x_spec.rb"]
    theirs = ["db/migrate/20261023120000_theirs.rb", "server/migrations/0042_theirs.py", "server/migrations/0043_more.py"]
    record = migrations(ours, theirs, DIRS)
    assert (record["ours"], record["upstream"]) == (2, 3)
    assert record["shared_dirs"] == ["db/migrate", "server/migrations"]
    assert record["same_prefix"] == [{"dir": "server/migrations", "prefix": "0042", "ours": ["server/migrations/0042_ours.py"], "upstream": ["server/migrations/0042_theirs.py"]}]


def test_migrations_on_one_side_only_share_nothing():
    record = migrations([], ["db/migrate/20261021_theirs.rb"], DIRS)
    assert (record["ours"], record["upstream"], record["shared_dirs"], record["same_prefix"]) == (0, 1, [], [])


def release(tag, published, body):
    return {"tag_name": tag, "published_at": published, "html_url": f"https://x/{tag}", "body": body}


def test_release_notes_since_our_base_flag_breaking_changes_and_required_steps_only():
    releases = [
        release("v2.54.0", "2026-10-20T00:00:00Z", "## ⚠️ Breaking changes\n- [BREAKING_CHANGE] Replace vetted apps"),
        release("v2.53.1", "2026-10-10T00:00:00Z", "One upgrade step is required. The package moves to 7.x."),
        release("v2.53.0", "2026-10-01T00:00:00Z", "* Heading anchor widget breaking IME composition"),
        release("v2.52.0", "2026-09-01T00:00:00Z", "Breaking changes we already have"),
    ]
    record = release_notes(releases, "v2.52.0", "2026-01-01T00:00:00Z")
    assert (record["basis"], record["since"], record["releases"]) == ("release", "v2.52.0", 3)
    assert [item["tag"] for item in record["flagged"]] == ["v2.54.0", "v2.53.1"]
    assert record["flagged"][0]["lines"] == ["⚠️ Breaking changes", "[BREAKING_CHANGE] Replace vetted apps"]


def test_without_a_base_release_notes_published_since_our_last_merge_count():
    releases = [release("7.2.2", "2026-10-08T00:00:00Z", "Manual migration required"), release("7.2.1", "2026-08-01T00:00:00Z", "BREAKING")]
    record = release_notes(releases, None, "2026-09-03T00:00:00Z")
    assert (record["basis"], record["releases"], [item["tag"] for item in record["flagged"]]) == ("commits", 1, ["7.2.2"])


def test_a_migration_we_took_from_upstream_is_not_ours_or_a_collision():
    taken = "db/migrate/20261006120000_add_setting.rb"
    record = migrations([taken, "db/migrate/20261007000000_ours.rb"], [taken, "db/migrate/20261023000000_theirs.rb"], DIRS)
    assert (record["ours"], record["upstream"], record["same_prefix"]) == (1, 2, [])
    assert record["shared_dirs"] == ["db/migrate"]

import subprocess

from collectors.fleet.upgrade import _flags, migration, migrations, net_added, release_notes

DIRS = ["migrations", "migrate"]
ENV = {"GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t", "PATH": "/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin"}


def test_migrations_are_entries_directly_in_a_migrations_folder():
    assert migration("db/migrate/20261006_add.rb", DIRS) == ("db/migrate", "20261006_add.rb")
    assert migration("prisma/migrations/20240101_x/migration.sql", DIRS) == ("prisma/migrations", "20240101_x")
    assert migration("server/migrations/0042_add.py", DIRS) == ("server/migrations", "0042_add.py")


def test_numbered_files_in_category_subfolders_are_their_own_migrations():
    assert migration("backend/src/app/migrations/sql/0140-add.sql", DIRS) == ("backend/src/app/migrations/sql", "0140-add.sql")
    record = migrations(["app/migrations/sql/0141-ours.sql"], ["app/migrations/sql/0141-theirs.sql", "app/migrations/sql/0142-more.sql"], DIRS)
    assert (record["ours"], record["upstream"], record["sequential_dirs"]) == (1, 2, ["app/migrations/sql"])
    assert [clash["prefix"] for clash in record["same_prefix"]] == ["0141"]
    ts = migrations(["core/migrations/common/1700000000001-ours.ts"], ["core/migrations/common/1700000000002-theirs.ts"], DIRS)
    assert (ts["ours"], ts["upstream"], ts["shared_dirs"], ts["sequential_dirs"], ts["same_prefix"]) == (1, 1, ["core/migrations/common"], [], [])


def test_laravel_dates_are_timestamps_and_alembic_ids_are_not_numbers():
    laravel = migrations(["database/migrations/2024_03_01_000000_add_x.php"], ["database/migrations/2024_05_09_000000_add_y.php"], DIRS)
    assert (laravel["sequential_dirs"], laravel["same_prefix"]) == ([], [])
    alembic = migrations(["alembic/versions/3f2a_ours.py"], ["alembic/versions/3b9c_theirs.py"], ["versions"])
    assert (alembic["sequential_dirs"], alembic["same_prefix"]) == ([], [])


def test_test_trees_helpers_and_package_markers_are_not_migrations():
    for path in [
        "spec/db/migrate/add_spec.rb",
        "packages/server/test/integration/migrations/x.ts",
        "src/migrations/utils/deep/helper.ts",
        "backend/app/migrations/__init__.py",
        "app/jobs/migration/replace_job.rb",
        "README.md",
    ]:
        assert migration(path, DIRS) is None, path


def test_sequential_numbers_on_both_sides_are_a_risk_and_a_shared_number_is_a_clash():
    ours = ["app/migrations/0042_ours.py"]
    theirs = ["app/migrations/0042_theirs.py", "app/migrations/0043_more.py"]
    record = migrations(ours, theirs, DIRS)
    assert (record["ours"], record["upstream"], record["shared_dirs"], record["sequential_dirs"]) == (1, 2, ["app/migrations"], ["app/migrations"])
    assert record["same_prefix"] == [{"dir": "app/migrations", "prefix": "0042", "ours": ["0042_ours.py"], "upstream": ["0042_theirs.py"]}]


def test_timestamped_migrations_side_by_side_are_reported_but_not_a_numbering_risk():
    record = migrations(["db/migrate/20261006120000_ours.rb"], ["db/migrate/20261023120000_theirs.rb"], DIRS)
    assert (record["shared_dirs"], record["sequential_dirs"], record["same_prefix"]) == (["db/migrate"], [], [])


def test_a_migration_we_took_from_upstream_is_not_ours():
    taken = "db/migrate/20261006120000_add_setting.rb"
    record = migrations([taken, "db/migrate/20261007000000_ours.rb"], [taken, "db/migrate/20261023000000_theirs.rb"], DIRS)
    assert (record["ours"], record["upstream"], record["same_prefix"]) == (1, 2, [])


def git(*args, cwd):
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True, env=ENV).stdout.strip()


def test_net_additions_leave_out_files_added_and_later_removed(tmp_path):
    git("init", "-b", "main", cwd=tmp_path)
    (tmp_path / "a.txt").write_text("a")
    git("add", ".", cwd=tmp_path)
    git("commit", "-m", "base", cwd=tmp_path)
    base = git("rev-parse", "HEAD", cwd=tmp_path)
    (tmp_path / "db").mkdir()
    (tmp_path / "db" / "001_kept.rb").write_text("1")
    (tmp_path / "db" / "002_reverted.rb").write_text("2")
    git("add", ".", cwd=tmp_path)
    git("commit", "-m", "add", cwd=tmp_path)
    git("rm", "-q", "db/002_reverted.rb", cwd=tmp_path)
    git("commit", "-m", "revert", cwd=tmp_path)
    assert net_added(tmp_path, base, "HEAD") == ["db/001_kept.rb"]


def release(tag, published, body):
    return {"tag_name": tag, "published_at": published, "html_url": f"https://x/{tag}", "body": body}


def test_release_notes_flag_breaking_changes_and_required_steps_but_not_negations():
    for flagged in ["## ⚠️ Breaking changes", "[BREAKING_CHANGE] Replace apps", "One upgrade step is required.", "### Breaking", "Breaking: drop node 16", "This is not backwards compatible", "Incompatible change to the API", "Major Changes", "Manual migration required", "fix: zero-downtime migration required for big tables"]:
        assert _flags(flagged.lstrip("#*- ").strip()), flagged
    for quiet in ["No breaking changes in this release", "This is a non-breaking change", "No migration required", "No manual migration needed", "No database migration required", "Heading anchor widget breaking IME composition"]:
        assert not _flags(quiet), quiet


def test_release_notes_above_our_base_are_flagged_with_padded_versions_and_deduplicated_lines():
    releases = [
        release("v2.54.0", "2026-10-20T00:00:00Z", "## Breaking changes\n## Breaking changes\n- [BREAKING_CHANGE] Replace vetted apps"),
        release("v2.53.1", "2026-10-10T00:00:00Z", "One upgrade step is required."),
        release("v2.53.0", "2026-10-01T00:00:00Z", "No breaking changes"),
        release("v2.52.0", "2026-09-01T00:00:00Z", "Breaking changes we already have"),
    ]
    record = release_notes(releases, "v2.52", "2026-01-01T00:00:00Z")
    assert (record["basis"], record["since"], record["releases"]) == ("release", "v2.52", 3)
    assert [item["tag"] for item in record["flagged"]] == ["v2.54.0", "v2.53.1"]
    assert record["flagged"][0]["lines"] == ["Breaking changes", "[BREAKING_CHANGE] Replace vetted apps"]


def test_without_a_base_a_backport_on_an_older_line_is_not_pending():
    releases = [
        release("6.5.4", "2026-10-09T00:00:00Z", "Manual migration required"),
        release("7.2.2", "2026-10-08T00:00:00Z", "Manual migration required"),
        release("7.2.1", "2026-08-01T00:00:00Z", "BREAKING"),
    ]
    record = release_notes(releases, None, "2026-09-03T00:00:00Z")
    assert (record["basis"], record["since"], record["releases"], [item["tag"] for item in record["flagged"]]) == ("commits", "7.2.1", 1, ["7.2.2"])
